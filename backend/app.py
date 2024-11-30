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
import traceback
lock = threading.Lock()
last_request_time = datetime.now() - timedelta(seconds=60)  # Initialize to allow immediate first request

# Global variables for rate limiting and caching
trends_cache = {}
trends_cache_time = None
cache_duration = timedelta(minutes=30)

load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:8081", "http://127.0.0.1:8081"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

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

@app.route('/generate-overview-questions', methods=['POST', 'OPTIONS'])
def generate_overview_questions():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    try:
        data = request.json
        role = data.get('role')
        selected_jobs = data.get('selectedJobs', [])
        
        if role == 'worker':
            job_titles = [job.get('title', '') for job in selected_jobs]
            
            # Generate questions based on selected jobs
            questions = [
                f"What specific qualifications or certifications do you have related to {', '.join(job_titles)}?",
                "How many years of experience do you have in these or related roles?",
                "What technical skills and tools are you proficient in?",
                "What are your most notable achievements or successful projects in similar positions?",
                "What relevant education or training do you have for these roles?"
            ]
            
            return jsonify({
                "success": True,
                "questions": questions
            })
        else:
            return jsonify({
                "success": False,
                "error": "Employer questions not implemented"
            }), 501
            
    except Exception as e:
        print(f"Error generating questions: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/generate-overview', methods=['POST'])
def generate_overview():
    try:
        data = request.json
        role = data.get('role')
        responses = data.get('responses', {})
        selected_jobs = data.get('selectedJobs', [])
        industry_prefs = data.get('industryPrefs', [])

        if role == 'worker':
            # Create a prompt that focuses on professional experience
            job_titles = [job.get('title', '') for job in selected_jobs]
            prompt = f"""Create a professional overview based on these responses:
            Selected jobs: {job_titles}
            Industries: {industry_prefs}
            Responses: {responses}
            
            Focus on highlighting qualifications, experience, and skills relevant to {', '.join(job_titles)}.
            Keep it concise, professional, and focused on career achievements."""

            messages = [
                {"role": "system", "content": "You are an expert at crafting professional profiles focused on qualifications and experience."},
                {"role": "user", "content": prompt}
            ]
            
            response = make_openai_request(messages)
            
            return jsonify({
                "success": True,
                "overview": response
            })
        else:
            return jsonify({
                "success": False,
                "error": "Employer overview generation not implemented"
            }), 501
            
    except Exception as e:
        print(f"Error generating overview: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
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

# Update the PyTrends initialization
def get_pytrends_client():
    try:
        return TrendReq(
            hl='en-US',
            tz=360,
            requests_args={
                'verify': True
            }
        )
    except Exception as e:
        print(f"Error initializing PyTrends: {str(e)}")
        return None

@app.route('/trending-industries', methods=['GET'])
def get_trending_industries():
    try:
        search_term = request.args.get('searchTerm', '').lower()
        print(f"Searching for industries with term: {search_term}")
        
        global trends_cache_time, trends_cache
        current_time = datetime.now()
        
        with lock:
            if (trends_cache_time is None or 
                current_time - trends_cache_time > cache_duration or 
                not trends_cache):
                
                try:
                    print("Fetching fresh trends data...")
                    pytrends = TrendReq(hl='en-US', tz=360)
                    
                    # Use job-specific keywords
                    keywords_batches = [
                        ["technology jobs hiring", "healthcare jobs hiring"],
                        ["finance jobs available", "retail jobs hiring"],
                        ["manufacturing jobs open", "construction jobs hiring"]
                    ]
                    
                    industry_interests = {}
                    
                    for batch in keywords_batches:
                        try:
                            print(f"Processing batch: {batch}")
                            time.sleep(1)
                            
                            pytrends.build_payload(
                                batch,
                                timeframe='today 3-m',  # Last 3 months for recent trends
                                geo='US'
                            )
                            
                            interest_data = pytrends.interest_over_time()
                            
                            if interest_data is not None and not interest_data.empty:
                                # Calculate trend momentum (recent growth)
                                recent_data = interest_data.tail(12)  # Last 12 weeks
                                older_data = interest_data.head(12)   # Previous 12 weeks
                                
                                for keyword in batch:
                                    recent_avg = recent_data[keyword].mean()
                                    older_avg = older_data[keyword].mean()
                                    growth = ((recent_avg - older_avg) / older_avg) * 100 if older_avg > 0 else 0
                                    
                                    # Clean industry name
                                    industry = (keyword
                                        .replace(' jobs hiring', '')
                                        .replace(' jobs available', '')
                                        .replace(' jobs open', '')
                                        .title())
                                    
                                    # Score combines current interest and growth
                                    score = recent_avg * (1 + growth/100)
                                    industry_interests[industry] = score
                                    print(f"Added trending industry: {industry} (score: {score}, growth: {growth}%)")
                            
                        except Exception as batch_error:
                            print(f"Error processing batch {batch}: {str(batch_error)}")
                            continue
                    
                    # Sort industries by score
                    trends_cache = sorted(
                        industry_interests.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )
                    print(f"Sorted trending industries: {trends_cache}")
                    trends_cache_time = current_time
                    
                except Exception as e:
                    print(f"PyTrends error: {str(e)}")
                    trends_cache = []
                    trends_cache_time = current_time
            
            # Default industries with lower weights
            default_industries = [
                ("Education", 45),
                ("Transportation", 40),
                ("Entertainment", 35),
                ("Hospitality", 30)
            ]
            
            # Get just the industry names from trends_cache
            trending_industries = [ind for ind, _ in trends_cache]
            
            # Add default industries that aren't already included
            result = trending_industries + [
                ind for ind, _ in default_industries 
                if ind not in trending_industries
            ]
            
            # Filter by search term if provided
            if search_term:
                filtered_industries = [
                    industry for industry in result 
                    if search_term in industry.lower()
                ]
                result = filtered_industries if filtered_industries else result[:10]
            else:
                result = result[:10]
            
            print(f"Returning industries (first is most trending): {result}")
            return jsonify({
                "success": True,
                "industries": result
            })
            
    except Exception as e:
        print(f"Error in trending industries: {str(e)}")
        return jsonify({
            "success": True,
            "industries": [
                "Technology", "Healthcare", "Finance", "Manufacturing",
                "Construction", "Retail", "Education", "Transportation",
                "Entertainment", "Hospitality"
            ]
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
                job_interests = {}
                
                # More natural search terms
                search_batches = [
                    [f"store manager jobs", f"sales associate jobs"],  # Common retail jobs
                    [f"{industry.lower()} jobs", f"{industry.lower()} careers"],  # Industry-specific
                    [f"{industry.lower()} positions", f"{industry.lower()} work"]  # Additional terms
                ]
                
                for batch in search_batches:
                    try:
                        print(f"Processing job batch: {batch}")
                        time.sleep(1)  # Rate limiting
                        
                        pytrends.build_payload(
                            batch,
                            timeframe='today 3-m',
                            geo='US'
                        )
                        
                        interest_data = pytrends.interest_over_time()
                        
                        if interest_data is not None and not interest_data.empty:
                            recent_data = interest_data.tail(12)
                            older_data = interest_data.head(12)
                            
                            for keyword in batch:
                                recent_avg = recent_data[keyword].mean()
                                older_avg = older_data[keyword].mean()
                                growth = ((recent_avg - older_avg) / older_avg) * 100 if older_avg > 0 else 0
                                
                                # Clean job title without industry prefix
                                job_title = (keyword
                                    .replace(' jobs', '')
                                    .replace(' careers', '')
                                    .replace(' positions', '')
                                    .replace(' work', '')
                                    .replace(industry.lower(), '')
                                    .strip()
                                    .title())
                                
                                score = recent_avg * (1 + growth/100)
                                job_interests[job_title] = score
                                print(f"Added trending job: {job_title} (score: {score}, growth: {growth}%)")
                    
                    except Exception as batch_error:
                        print(f"Error processing job batch {batch}: {str(batch_error)}")
                        continue
                
                if job_interests:
                    trending_jobs = sorted(
                        job_interests.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )
                    
                    jobs_list = [job for job, _ in trending_jobs]
                    
                    # Combine with industry-specific fallback jobs
                    fallback = fallback_jobs.get(industry, [])
                    result = jobs_list + [j for j in fallback if j not in jobs_list]
                    
                    print(f"Found trending jobs for {industry}: {result[:10]}")
                    return jsonify({
                        "success": True,
                        "jobs": result[:10]
                    })
        
        except Exception as e:
            print(f"PyTrends error in jobs: {str(e)}")
            print(f"Error traceback: {traceback.format_exc()}")
        
        # Fall back to default jobs if PyTrends fails
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
        
        if not job_title:
            return jsonify({
                "success": False,
                "error": "Job title is required"
            }), 400

        # Try multiple search terms for better coverage
        search_terms = [
            f"{job_title} required skills",
            f"{job_title} qualifications",
            f"{industry} {job_title} skills"
        ]
        
        trending_skills = set()
        
        for search_term in search_terms:
            try:
                print(f"Querying PyTrends for: {search_term}")
                pytrends.build_payload([search_term], timeframe='today 3-m', geo='US')
                time.sleep(1)  # Rate limiting
                
                # Try both topics and queries
                topics = pytrends.related_topics()
                if topics and search_term in topics:
                    for topic_type in ['top', 'rising']:
                        if topic_type in topics[search_term]:
                            df = topics[search_term][topic_type]
                            if isinstance(df, pd.DataFrame) and not df.empty:
                                for _, row in df.iterrows():
                                    skill = clean_skill_name(row['topic_title'])
                                    if skill:
                                        trending_skills.add(skill)
                                        print(f"Found skill: {skill}")
                
                queries = pytrends.related_queries()
                if queries and search_term in queries:
                    for query_type in ['top', 'rising']:
                        if query_type in queries[search_term]:
                            df = queries[search_term][query_type]
                            if isinstance(df, pd.DataFrame) and not df.empty:
                                for _, row in df.iterrows():
                                    skill = clean_skill_name(row['query'])
                                    if skill:
                                        trending_skills.add(skill)
                                        print(f"Found skill from query: {skill}")
            
            except Exception as e:
                print(f"Error processing search term {search_term}: {str(e)}")
                continue
        
        if trending_skills:
            skills_list = list(trending_skills)
            print(f"Found trending skills: {skills_list}")
            return jsonify({
                "success": True,
                "skills": skills_list[:10]
            })
        
        # Fall back to industry-based skills
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
        }), 500

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

@app.route('/check-skill-relevance', methods=['POST'])
def check_skill_relevance():
    try:
        data = request.json
        skill1 = data['skill1']
        skill2 = data['skill2']
        
        # First check exact match
        if skill1.lower() == skill2.lower():
            return jsonify({"isRelevant": True})
            
        # Define skill categories and their related terms
        skill_categories = {
            "manual_labor": [
                "manual labor", "physical work", "hands-on", "working with hands",
                "manual dexterity", "physical strength", "lifting", "construction",
                "assembly", "manufacturing", "mechanical"
            ],
            "customer_service": [
                "customer service", "client relations", "people skills",
                "interpersonal", "communication", "customer support",
                "client interaction", "public relations"
            ],
            # Add more categories as needed
        }
        
        # Check if skills are in the same category
        for category in skill_categories.values():
            if any(term in skill1.lower() for term in category) and \
               any(term in skill2.lower() for term in category):
                return jsonify({"isRelevant": True})
        
        # If not found in predefined categories, use OpenAI to check relevance
        messages = [
            {"role": "system", "content": """You are a skill matching expert. 
             Determine if two skills are relevant or similar to each other.
             Consider both direct and indirect relationships.
             For example: 'Manual Labor' is relevant to 'Working with Hands'."""},
            {"role": "user", "content": f"""Are these two skills related or relevant to each other?
             Skill 1: {skill1}
             Skill 2: {skill2}
             
             Answer with only 'true' or 'false'."""}
        ]
        
        response = make_openai_request(messages)
        is_relevant = response.strip().lower() == 'true'
        
        # Cache the result for future use
        cache_key = f"{skill1.lower()}_{skill2.lower()}"
        skill_relevance_cache[cache_key] = is_relevant
        
        return jsonify({"isRelevant": is_relevant})
        
    except Exception as e:
        print(f"Error checking skill relevance: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Initialize a cache for skill relevance results
skill_relevance_cache = {}

def clean_job_title(query):
    """Clean and validate job titles"""
    remove_terms = [
        'jobs', 'job', 'career', 'careers', 'position', 'positions',
        'hiring', 'wanted', 'needed', 'required', 'immediate', 'urgent'
    ]
    
    query = query.lower()
    for term in remove_terms:
        query = query.replace(term, '')
    
    title = query.strip().title()
    if len(title) > 2 and not any(char.isdigit() for char in title):
        return title
    return None

if __name__ == '__main__':
    app.run(debug=True) 