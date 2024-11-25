from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI, OpenAIError
import os
from dotenv import load_dotenv
import json
from pytrends.request import TrendReq
import time
from functools import lru_cache
import random
from datetime import datetime, timedelta
import threading
import pandas as pd
from time import sleep
from random import uniform
lock = threading.Lock()
last_request_time = datetime.now() - timedelta(seconds=60)  # Initialize to allow immediate first request

# Global variables for rate limiting and caching
trends_cache = {}
trends_cache_time = None
cache_duration = timedelta(minutes=30)

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("Warning: OpenAI API key not found in environment variables")
    
client = OpenAI(api_key=api_key)

pytrends = TrendReq(hl='en-US', tz=360)

def generate_fallback_analysis(job_data, user_data):
    """Generate a basic analysis without using OpenAI"""
    analysis = []
    
    # Skills match
    matching_skills = set(job_data.get('requiredSkills', [])) & set(user_data.get('skills', []))
    if matching_skills:
        analysis.append(f"You have {len(matching_skills)} relevant skills for this position: {', '.join(matching_skills)}.")
    
    # Experience match
    if user_data.get('experience', {}).get('totalYears'):
        analysis.append(f"You have {user_data['experience']['totalYears']} years of relevant experience.")
    
    # Location match
    if job_data.get('distance'):
        analysis.append(f"This job is approximately {job_data['distance']} miles from your location.")
    
    # Compensation match
    if job_data.get('salaryRange'):
        analysis.append(f"The pay range (${job_data['salaryRange']['min']}-${job_data['salaryRange']['max']}/hr) aligns with market rates.")
    
    return " ".join(analysis)

def make_openai_request(messages, max_tokens=300, temperature=0.7):
    """Centralized function for making OpenAI API calls with error handling"""
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except OpenAIError as e:
        print(f"OpenAI API error: {str(e)}")
        raise e
    except Exception as e:
        print(f"Unexpected error in OpenAI request: {str(e)}")
        raise e

@app.route('/analyze-job-match', methods=['POST'])
def analyze_job_match():
    try:
        data = request.json
        job_data = data.get('job', {})
        user_data = data.get('user', {})
        
        try:
            messages = [
                {"role": "system", "content": "You are a job matching expert providing friendly, detailed analysis."},
                {"role": "user", "content": f"Analyze this job match. Job: {job_data}, User: {user_data}"}
            ]
            analysis = make_openai_request(messages)
        except Exception as e:
            print(f"Falling back to basic analysis: {e}")
            analysis = generate_fallback_analysis(job_data, user_data)
        
        return jsonify({
            "success": True,
            "analysis": analysis
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error: {str(e)}"
        }), 500

def parse_llm_response(response_text):
    """Parse the LLM response into a list of suggestions"""
    try:
        # Try to parse JSON from the response
        if isinstance(response_text, str):
            suggestions = json.loads(response_text)
            if isinstance(suggestions, list):
                return suggestions
        
        # If we got a string, split it into lines
        return [s.strip() for s in response_text.split('\n') if s.strip()]
    except:
        # Fallback suggestions
        return [
            "What are the next steps in the process?",
            "Could you tell me more about the role?",
            "What does a typical day look like?",
            "What are the main responsibilities?"
        ]

@app.route('/generate-chat-suggestions', methods=['POST'])
def generate_chat_suggestions():
    try:
        data = request.json
        role = data['role']
        job_title = data['jobTitle']
        company = data['company']
        recent_messages = data.get('recentMessages', [])

        try:
            # Add timestamp to force variation
            current_time = datetime.now().strftime("%H:%M:%S")
            
            messages = [
                {"role": "system", "content": "You are a helpful assistant generating unique chat suggestions. Never repeat previous suggestions."},
                {"role": "user", "content": f"""Generate 3 completely new, different questions/messages for a {role} chatting about a {job_title} position at {company}.
                Current time: {current_time}
                Recent messages in the chat: {recent_messages}
                
                The suggestions should be:
                - Completely different from any previous suggestions
                - Natural and conversational
                - Relevant to the context
                - Professional but friendly
                - Specific to the role/company
                - Cover different aspects (e.g., culture, responsibilities, growth)
                
                Return only a JSON array of 3 unique strings."""}
            ]
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=1.0,  # Maximum creativity
                presence_penalty=0.9,  # Encourage different content
                frequency_penalty=0.9,  # Discourage repetition
                max_tokens=200
            )
            
            suggestions = parse_llm_response(response.choices[0].message.content)
            
            # Ensure we have exactly 3 suggestions
            if not suggestions or len(suggestions) < 3:
                fallback = get_fallback_suggestions(role)
                suggestions = (suggestions or []) + fallback
            
            # Randomize order
            random.shuffle(suggestions)
            
            return jsonify({
                "success": True,
                "suggestions": suggestions[:3]
            })
            
        except Exception as e:
            print(f"Error generating suggestions: {e}")
            suggestions = get_fallback_suggestions(role)
            random.shuffle(suggestions)
            return jsonify({
                "success": True,
                "suggestions": suggestions[:3]
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error: {str(e)}"
        }), 500

def get_fallback_suggestions(role):
    """Get role-specific fallback suggestions"""
    worker_suggestions = [
        "What opportunities for professional development are available?",
        "Could you describe the team culture?",
        "What does success look like in this role?",
        "What are the biggest challenges in this position?",
        "How would you describe the work-life balance?",
        "What's the typical career progression for this role?",
        "Can you tell me about the onboarding process?",
        "What technologies or tools does the team use?",
        "How does the team handle project deadlines?",
        "What's your favorite part about working here?"
    ]
    
    employer_suggestions = [
        "What interests you most about this position?",
        "Could you describe your ideal work environment?",
        "What are your career goals?",
        "How do you handle challenging situations?",
        "What's your approach to problem-solving?",
        "Could you share an example of a successful project?",
        "What motivates you in your work?",
        "How do you stay updated in your field?",
        "What's your preferred management style?",
        "What questions do you have about the role?"
    ]
    
    suggestions = worker_suggestions if role == 'worker' else employer_suggestions
    return random.sample(suggestions, 3)

@app.route('/generate-overview-questions', methods=['POST'])
def generate_overview_questions():
    try:
        data = request.json
        role = data['role']
        selected_jobs = data.get('selectedJobs', [])
        industry_prefs = data.get('industryPrefs', [])

        if role == 'worker':
            prompt = f"""Generate 5 relevant questions to create a worker profile overview. 
            Their selected industries are: {industry_prefs}
            Their selected jobs are: {selected_jobs}
            
            Questions should cover:
            - Educational background
            - Relevant certifications
            - Work experience
            - Key achievements
            - Career goals
            
            Format: Return only the questions as a JSON array of strings."""
        else:
            prompt = """Generate 5 relevant questions to create a job posting overview.
            
            Questions should cover:
            - Ideal candidate profile
            - Key responsibilities
            - Work environment
            - Growth opportunities
            - Company culture
            
            Format: Return only the questions as a JSON array of strings."""

        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert at creating professional profiles and job descriptions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            questions = parse_llm_response(response.choices[0].message.content)
            
            return jsonify({
                "success": True,
                "questions": questions
            })
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            # Fallback questions based on role
            if role == 'worker':
                questions = [
                    "What is your highest level of education?",
                    "What relevant certifications do you hold?",
                    "Describe your work experience in this field.",
                    "What are your key professional achievements?",
                    "What are your career goals?"
                ]
            else:
                questions = [
                    "What are the key responsibilities for this role?",
                    "What qualifications should the ideal candidate have?",
                    "How would you describe the work environment?",
                    "What growth opportunities are available?",
                    "What makes your company culture unique?"
                ]
            
            return jsonify({
                "success": True,
                "questions": questions
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error: {str(e)}"
        }), 500

@app.route('/generate-overview', methods=['POST'])
def generate_overview():
    try:
        data = request.json
        role = data['role']
        responses = data['responses']
        selected_jobs = data.get('selectedJobs', [])
        industry_prefs = data.get('industryPrefs', [])

        if role == 'worker':
            prompt = f"""Create a detailed, first-person professional profile using the information provided in these responses:

            Responses: {json.dumps(responses, indent=2)}
            Desired Industries: {json.dumps(industry_prefs, indent=2)}
            Desired Positions: {json.dumps(selected_jobs, indent=2)}

            Important guidelines:
            - Use ONLY the information provided, but make meaningful connections between different pieces of information
            - Acknowledge any certifications or experience that might be different from the desired roles, but frame them positively
            - Create natural transitions between different aspects (education, experience, goals)
            - Keep the tone professional yet conversational
            - Explain how past experience and skills could transfer to desired roles
            - Be specific when mentioning achievements or experiences
            
            For example:
            - If someone has medical certifications but is seeking retail work, explain how patient care skills transfer to customer service
            - If someone has education in one field but seeking work in another, highlight transferable skills
            - When mentioning achievements, include specific impacts or recognition
            - When discussing goals, connect them to current experience and desired roles

            Make the narrative flow naturally while maintaining professional language."""

        else:
            prompt = f"""Create a detailed, engaging job posting overview using the information provided in these responses:

            {json.dumps(responses, indent=2)}

            Important guidelines:
            - Paint a clear picture of both the role and the workplace environment
            - Be specific about requirements while remaining welcoming
            - Explain how different aspects of the role connect to growth opportunities
            - Highlight unique aspects of the company culture with concrete examples
            - Make clear connections between responsibilities and qualifications
            - Use engaging, active language while maintaining professionalism
            
            For example:
            - Instead of just listing responsibilities, explain their impact
            - Connect required qualifications to specific aspects of the role
            - Describe how the work environment supports employee success
            - Explain how growth opportunities align with company culture"""

        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert writer who creates detailed, contextual professional narratives. You excel at making meaningful connections between different pieces of information and explaining their relevance."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            overview = response.choices[0].message.content
            
            return jsonify({
                "success": True,
                "overview": overview
            })
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            # More structured fallback
            if role == 'worker':
                overview = f"With a background in {responses.get('Describe your work experience in this field.', 'various fields')}, I am seeking opportunities in {', '.join(industry_prefs)}. {responses.get('What relevant certifications do you hold?', '')} While my certifications and experience may be in different areas, these skills are transferable to my desired roles. {responses.get('What are your key professional achievements?', '')} Looking ahead, {responses.get('What are your career goals?', '')}"
            else:
                overview = f"We are seeking candidates for a role that involves {responses.get('What are the key responsibilities for this role?', '')}. The ideal candidate should have {responses.get('What qualifications should the ideal candidate have?', '')}. Our workplace offers {responses.get('How would you describe the work environment?', '')} with opportunities for {responses.get('What growth opportunities are available?', '')}. What makes us unique is that {responses.get('What makes your company culture unique?', '')}."
            
            return jsonify({
                "success": True,
                "overview": overview
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error: {str(e)}"
        }), 500

@lru_cache(maxsize=128)
def get_cached_trends(search_term=''):
    """Cache trending results to avoid hitting rate limits"""
    return fetch_trending_data(search_term)

def fetch_trending_data(search_term=''):
    """Fetch trending data with rate limiting"""
    try:
        pytrends = TrendReq(hl='en-US', tz=360)
        
        # Simplified payload with single keyword
        kw_list = ["industry trends"]
        
        pytrends.build_payload(
            kw_list,
            timeframe='today 12-m',
            geo='US'
        )
        
        # Get related queries
        related_queries = pytrends.related_queries()
        trending_industries = set()
        
        if related_queries and kw_list[0] in related_queries:
            for query_type in ['top', 'rising']:
                if query_type in related_queries[kw_list[0]]:
                    df = related_queries[kw_list[0]][query_type]
                    if isinstance(df, pd.DataFrame) and not df.empty:
                        for _, row in df.iterrows():
                            industry = clean_industry_name(row['query'])
                            if industry:
                                trending_industries.add(industry)
        
        # Always include default industries
        default_industries = [
            'Technology', 'Healthcare', 'Finance', 'Education',
            'Manufacturing', 'Retail', 'Entertainment', 'Construction',
            'Transportation', 'Hospitality'
        ]
        
        # Combine trending and default industries
        all_industries = list(trending_industries) + [
            ind for ind in default_industries 
            if ind not in trending_industries
        ]
        
        print(f"Fetched industries: {all_industries}")
        return all_industries
        
    except Exception as e:
        print(f"Error in fetch_trending_data: {str(e)}")
        return default_industries

def clean_industry_name(query):
    """Clean and validate industry names"""
    # Remove common suffixes and clean the string
    cleaners = [
        ' industry', ' sector', ' companies', ' market',
        ' business', ' services', ' technology'
    ]
    
    query = query.lower()
    for cleaner in cleaners:
        query = query.replace(cleaner, '')
    
    # Capitalize words
    industry = query.strip().title()
    
    # Validate the industry name
    if len(industry) > 2 and not any(char.isdigit() for char in industry):
        return industry
    return None

@app.route('/trending-industries', methods=['GET'])
def get_trending_industries():
    try:
        search_term = request.args.get('searchTerm', '').lower()
        print(f"Searching for industries with term: {search_term}")
        
        global trends_cache_time, trends_cache
        current_time = datetime.now()
        
        # Default industries list
        default_industries = [
            "Technology", "Healthcare", "Retail", "Finance", 
            "Education", "Manufacturing", "Hospitality", 
            "Construction", "Transportation", "Entertainment"
        ]
        
        with lock:
            # Check if we have valid cached data
            if (trends_cache_time is None or 
                current_time - trends_cache_time > cache_duration or 
                not trends_cache):
                
                try:
                    print("Fetching fresh trends data...")
                    # Initialize pytrends
                    pytrends = TrendReq(hl='en-US', tz=360)
                    
                    # Create multiple payloads for different aspects of industries
                    payloads = [
                        ["business sectors", "industry growth", "emerging markets"],
                        ["top industries", "growing industries", "industry trends"],
                        ["career industries", "job sectors", "employment trends"]
                    ]
                    
                    trending_industries = set()
                    
                    for kw_list in payloads:
                        try:
                            # Build payload
                            pytrends.build_payload(
                                kw_list,
                                timeframe='today 12-m',
                                geo='US',
                                cat=12  # Business category
                            )
                            
                            # Get related queries
                            related_queries = pytrends.related_queries()
                            
                            # Process each keyword's results
                            for kw in kw_list:
                                if kw in related_queries and related_queries[kw]:
                                    for query_type in ['top', 'rising']:
                                        queries = related_queries[kw].get(query_type)
                                        if isinstance(queries, pd.DataFrame) and not queries.empty:
                                            for _, row in queries.iterrows():
                                                query = row['query'].lower()
                                                # Clean and filter industry names
                                                if any(term in query for term in ['industry', 'sector', 'tech', 'healthcare', 'retail']):
                                                    clean_name = (query
                                                        .replace('industry', '')
                                                        .replace('sector', '')
                                                        .replace('companies', '')
                                                        .strip()
                                                        .title())
                                                    if len(clean_name) > 2:
                                                        trending_industries.add(clean_name)
                            
                            # Add a delay between requests
                            time.sleep(1)
                            
                        except Exception as e:
                            print(f"Error processing payload {kw_list}: {str(e)}")
                            continue
                    
                    # Update cache
                    trends_cache = list(trending_industries)
                    trends_cache_time = current_time
                    print(f"Found trending industries: {trends_cache}")
                    
                except Exception as e:
                    print(f"Error fetching trends: {str(e)}")
                    trends_cache = []
            
            # Combine trending and default industries
            all_industries = list(set(trends_cache + default_industries))
            
            # Filter by search term if provided
            if search_term:
                filtered_industries = [
                    industry for industry in all_industries 
                    if search_term in industry.lower()
                ]
                result = filtered_industries if filtered_industries else default_industries
            else:
                # Randomize order but ensure a mix of trending and default
                random.shuffle(all_industries)
                result = all_industries[:10]
            
            print(f"Returning industries: {result}")
            return jsonify({
                "success": True,
                "industries": result
            })
            
    except Exception as e:
        print(f"Error in trending industries: {str(e)}")
        return jsonify({
            "success": True,
            "industries": default_industries
        })

@app.route('/trending-jobs', methods=['GET'])
def get_trending_jobs():
    try:
        industry = request.args.get('industry', '')
        print(f"Fetching jobs for industry: {industry}")
        
        # Fallback jobs dictionary
        fallback_jobs = {
            "Technology": ["Software Engineer", "Data Analyst", "Product Manager", "IT Support", "Web Developer"],
            "Healthcare": ["Nurse", "Medical Assistant", "Healthcare Administrator", "Physical Therapist", "Pharmacist"],
            "Retail": ["Store Manager", "Sales Associate", "Retail Supervisor", "Cashier", "Visual Merchandiser"],
            "Finance": ["Financial Analyst", "Accountant", "Investment Banker", "Financial Advisor", "Credit Analyst"],
            "Education": ["Teacher", "Professor", "Education Administrator", "Curriculum Developer", "School Counselor"],
            "Manufacturing": ["Production Manager", "Quality Control", "Process Engineer", "Operations Manager", "Manufacturing Technician"],
            "Hospitality": ["Hotel Manager", "Chef", "Restaurant Manager", "Event Coordinator", "Customer Service Representative"],
            "Construction": ["Construction Manager", "Project Manager", "Civil Engineer", "Architect", "Construction Supervisor"],
            "Transportation": ["Logistics Manager", "Supply Chain Manager", "Fleet Manager", "Transportation Coordinator", "Dispatcher"],
            "Entertainment": ["Producer", "Director", "Content Creator", "Event Manager", "Marketing Coordinator"]
        }
        
        try:
            if industry:
                # Try to get trending jobs from Google Trends
                kw_list = [
                    f"{industry} jobs",
                    f"{industry} careers",
                    f"{industry} positions"
                ]
                pytrends.build_payload(kw_list, timeframe='today 12-m', geo='US')
                
                # Get related topics for job titles
                related_topics = pytrends.related_topics()
                trending_jobs = set()
                
                for kw in kw_list:
                    if kw in related_topics and related_topics[kw].get('top') is not None:
                        df = related_topics[kw]['top']
                        for _, row in df.iterrows():
                            job_title = (row['topic_title']
                                .replace(' (occupation)', '')
                                .replace(' job', '')
                                .replace(' position', '')
                                .title())
                            trending_jobs.add(job_title)
                
                if trending_jobs:
                    # Combine trending and fallback jobs
                    all_jobs = list(trending_jobs)
                    if industry in fallback_jobs:
                        all_jobs.extend([j for j in fallback_jobs[industry] if j not in trending_jobs])
                    return jsonify({
                        "success": True,
                        "jobs": all_jobs[:10]  # Limit to top 10
                    })
        
        except Exception as e:
            print(f"PyTrends error in jobs: {str(e)}")
        
        # Fall back to default jobs if PyTrends fails or no results
        jobs = fallback_jobs.get(industry, ["Manager", "Assistant", "Coordinator", "Specialist", "Supervisor"])
        return jsonify({
            "success": True,
            "jobs": jobs
        })
        
    except Exception as e:
        print(f"Error in trending jobs: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def make_pytrends_request(func):
    """Helper function for rate-limited requests"""
    max_retries = 3
    base_delay = 2
    
    for attempt in range(max_retries):
        try:
            # Initialize PyTrends with minimal settings
            pytrends = TrendReq(
                hl='en-US',
                tz=360
            )
            
            # Add delay between attempts
            if attempt > 0:
                sleep(base_delay * attempt)
            
            # Execute the provided function
            result = func(pytrends)
            return result
            
        except Exception as e:
            print(f"PyTrends attempt {attempt + 1} failed: {str(e)}")
            if attempt == max_retries - 1:
                raise e

@app.route('/trending-skills', methods=['GET'])
def get_trending_skills():
    try:
        job_title = request.args.get('jobTitle', '')
        industry = request.args.get('industry', '')
        print(f"Fetching skills for job: {job_title} in industry: {industry}")
        
        def fetch_skills(pytrends):
            trending_skills = set()
            
            # Use multiple search terms for better coverage
            search_terms = [
                f"{job_title} skills required",
                f"{job_title} {industry} skills",
                f"{job_title} qualifications"
            ]
            
            for search_term in search_terms:
                try:
                    print(f"Querying PyTrends for: {search_term}")
                    # Build payload with a single term
                    pytrends.build_payload(
                        kw_list=[search_term],
                        timeframe='today 12-m',
                        geo='US'
                    )
                    
                    # Get both related queries and topics
                    related_queries = pytrends.related_queries()
                    related_topics = pytrends.related_topics()
                    
                    print(f"Raw queries response: {related_queries}")
                    print(f"Raw topics response: {related_topics}")
                    
                    # Process related queries
                    if related_queries and search_term in related_queries:
                        for query_type in ['top', 'rising']:
                            queries = related_queries[search_term].get(query_type)
                            if isinstance(queries, pd.DataFrame) and not queries.empty:
                                for _, row in queries.iterrows():
                                    if 'query' in row:
                                        skill = clean_skill_name(row['query'])
                                        if skill:
                                            trending_skills.add(skill)
                    
                    # Process related topics
                    if related_topics and search_term in related_topics:
                        for topic_type in ['top', 'rising']:
                            topics = related_topics[search_term].get(topic_type)
                            if isinstance(topics, pd.DataFrame) and not topics.empty:
                                for _, row in topics.iterrows():
                                    if 'topic_title' in row:
                                        skill = clean_skill_name(row['topic_title'])
                                        if skill:
                                            trending_skills.add(skill)
                    
                    # Add delay between requests
                    sleep(2)
                    
                except Exception as e:
                    print(f"Error processing search term {search_term}: {str(e)}")
                    continue
            
            return list(trending_skills)
        
        # Try to get trending skills
        trending_skills = make_pytrends_request(fetch_skills)
        
        if trending_skills:
            print(f"Found trending skills: {trending_skills}")
            return jsonify({
                "success": True,
                "skills": trending_skills[:10]  # Return top 10 skills
            })
        
        # If no trending skills found, fall back to industry-based skills
        industry_skills = get_industry_based_skills(industry)
        print(f"Using industry-based skills for {job_title}")
        return jsonify({
            "success": True,
            "skills": industry_skills
        })
            
    except Exception as e:
        print(f"Error in trending skills: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        })

def get_industry_based_skills(industry):
    """Get industry-specific default skills"""
    industry_skills = {
        "Technology": [
            "Programming", "Cloud Computing", "Agile",
            "DevOps", "Cybersecurity", "Data Analysis",
            "Project Management", "API Integration",
            "Software Development", "Technical Documentation"
        ],
        "Education": [
            "Curriculum Development", "Assessment",
            "Educational Technology", "Classroom Management",
            "Differentiated Instruction", "Student Engagement",
            "Learning Management Systems", "Educational Psychology",
            "Special Education", "Student Assessment"
        ]
        # Add more industries...
    }
    
    return industry_skills.get(industry, [
        "Communication", "Problem Solving", "Team Work",
        "Project Management", "Time Management",
        "Leadership", "Analytics", "Critical Thinking",
        "Organization", "Attention to Detail"
    ])

def clean_skill_name(query):
    """Clean and validate skill names"""
    # Common terms to remove
    remove_terms = [
        'how to', 'what is', 'learn', 'certification',
        'course', 'training', 'skills in', 'skills for',
        'requirements', 'qualifications', 'needed', 'required'
    ]
    
    # Technical skills and tools to preserve
    technical_terms = [
        'python', 'sql', 'java', 'javascript', 'excel',
        'tableau', 'power bi', 'aws', 'azure', 'machine learning',
        'data analysis', 'statistics', 'r programming'
    ]
    
    query = query.lower()
    
    # Preserve technical terms
    for term in technical_terms:
        if term in query:
            return term.title()
    
    # Remove common terms
    for term in remove_terms:
        query = query.replace(term, '')
    
    # Clean and validate
    skill = query.strip().title()
    if len(skill) > 2 and not any(char.isdigit() for char in skill):
        return skill
    return None

@app.route('/suggest-skills', methods=['POST'])
def suggest_skills():
    try:
        data = request.json
        job_title = data.get('jobTitle', '')
        
        messages = [
            {"role": "system", "content": "You are a job skills expert. Provide relevant skills for job titles in JSON array format."},
            {"role": "user", "content": f"List 10 key skills required for a {job_title} position. Return only a JSON array of skill names."}
        ]
        
        response = make_openai_request(messages)
        
        # Parse the response into a list of skills
        try:
            skills = json.loads(response)
            if not isinstance(skills, list):
                skills = response.strip('[]').split(',')
        except:
            skills = response.strip('[]').split(',')
        
        # Clean and format skills
        skills = [s.strip().strip('"\'') for s in skills if s.strip()]
        
        return jsonify({
            "success": True,
            "skills": skills
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 