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
from serpapi import GoogleSearch
from collections import Counter
import re

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

SERP_API_KEY = os.getenv('SERP_API_KEY')  # Make sure this is set in your environment

# Add this near the top where other environment variables are loaded
print(f"SERP API Key loaded: {'*' * 5}{SERP_API_KEY[-5:] if SERP_API_KEY else 'None'}")

# Industry search terms for classification
industry_search_terms = {
    'Technology': [
        ['software', 'tech', 'IT', 'digital', 'computer'],
        ['artificial intelligence', 'machine learning', 'data science'],
        ['cybersecurity', 'cloud computing', 'blockchain']
    ],
    'Healthcare': [
        ['medical', 'health', 'healthcare', 'clinical'],
        ['hospital', 'pharmacy', 'nursing', 'dental'],
        ['biotech', 'life sciences', 'pharmaceutical']
    ],
    # Add more industries and their related terms
}

# Skill keywords for parsing job descriptions
skill_keywords = {
    'Technical': [
        'Python', 'JavaScript', 'Java', 'SQL', 'AWS', 'Azure',
        'Docker', 'Kubernetes', 'React', 'Angular', 'Node.js',
        'Machine Learning', 'AI', 'Data Science', 'Cloud Computing'
    ],
    'Soft Skills': [
        'Communication', 'Leadership', 'Problem Solving',
        'Team Collaboration', 'Project Management', 'Time Management',
        'Critical Thinking', 'Adaptability', 'Organization'
    ],
    # Add more skill categories
}

# Add this near the top of the file with other dictionaries
industry_jobs = {
    'Technology': [
        'Software Engineer',
        'Data Scientist',
        'IT Support',
        'System Administrator',
        'DevOps Engineer',
        'Product Manager',
        'QA Engineer',
        'Network Engineer',
        'Business Analyst',
        'Project Manager'
    ],
    'Healthcare': [
        'Registered Nurse',
        'Medical Assistant',
        'Physician',
        'Nurse Practitioner',
        'Physical Therapist',
        'Healthcare Administrator',
        'Medical Technologist',
        'Pharmacist',
        'Dental Hygienist',
        'Medical Records Specialist'
    ],
    # Add more industries and their common jobs
}

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
        print(f"DEBUG - Overview Questions - Role received: {role}")  # Debug log
        
        if role == 'employer':
            questions = [
                f"What are the primary responsibilities for this {data.get('jobTitle', '')} position?",
                "What qualifications or experience are required for this role?",
                "What makes your company culture unique?",
                "What growth or advancement opportunities are available?",
                "What benefits or perks do you offer employees?"
            ]
            
            # Add industry-specific questions
            industry_questions = {
                'Technology': [
                    "What development methodologies does your team use?",
                    "What is your tech stack?",
                    "How do you handle project deadlines and releases?"
                ],
                'Healthcare': [
                    "What patient populations will this role work with?",
                    "What medical technologies or systems do you use?",
                    "What are your quality of care standards?"
                ]
            }
            
            industry_prefs = data.get('industryPrefs', [])
            for industry in industry_prefs:
                if industry in industry_questions:
                    questions.extend(industry_questions[industry][:2])
            
            return jsonify({
                "success": True,
                "questions": questions[:7]  # Limit to 7 questions total
            })
        else:
            # Handle worker role
            return jsonify({
                "success": True,
                "questions": [
                    "What are your key skills and experience?",
                    "What interests you about this role?",
                    "What are your career goals?",
                    "What is your preferred work environment?",
                    "What are your salary expectations?"
                ]
            })

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
        
        print(f"DEBUG - Received role: {role}")  # Debug log
        print(f"DEBUG - Full request data: {data}")  # Debug log

        if role == 'employer':
            prompt = f"""Write a compelling job posting (maximum 200 characters) based on these responses:
            {responses}
            
            REQUIREMENTS:
            1. Start with "We are seeking..." or "We are looking for..."
            2. Write from the employer's perspective (using "we" and "our")
            3. Never use first person ("I" or "my")
            4. Format as a professional job posting
            5. Must be 200 characters or less
            
            Include key points about:
            - Role description and impact
            - Key responsibilities
            - Required qualifications
            - What we offer"""
        else:
            prompt = f"""Write a professional summary (maximum 200 characters) based on these responses:
            {responses}
            
            REQUIREMENTS:
            1. Write from the job seeker's perspective
            2. Use first person ("I" and "my")
            3. Format as a professional summary
            4. Highlight qualifications and experience
            5. Must be 200 characters or less
            
            Include key points about:
            - Professional background
            - Key skills and expertise
            - Career objectives"""

        messages = [
            {"role": "system", "content": "You are writing a concise professional overview."},
            {"role": "user", "content": prompt}
        ]
        
        response = make_openai_request(messages)
        # Truncate to 200 characters if needed
        response = response[:200]
        
        return jsonify({
            "success": True,
            "overview": response
        })

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

def format_location(location, try_city=False):
    """Helper function to format location for SERP API"""
    if not location:
        return 'United States'
        
    # If location contains a comma (city, state/region format)
    if ',' in location:
        city, region = location.split(',')
        # For non-US locations, just use the country name
        if region.strip() not in ['US', 'USA', 'United States']:
            return location.split(',')[0].strip()  # Return just the city name
            
    # If it's a single word, assume it's a country name
    return location.strip()

@app.route('/trending-industries', methods=['GET'])
def get_trending_industries():
    try:
        search_term = request.args.get('searchTerm', '').lower()
        user_location = request.args.get('location', 'United States')
        
        print(f"\n=== Getting Industries for search: '{search_term}' ===")
        
        # Get base industries from API
        industries = get_trending_industries_serp(search_term, user_location)
        
        # If there's a search term, also search directly for it
        if search_term:
            params = {
                "api_key": SERP_API_KEY,
                "engine": "google_jobs",
                "q": f"{search_term} jobs",
                "location": format_location(user_location),
                "hl": "en",
                "gl": "us",
                "chips": "date_posted:today"
            }
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            if 'jobs_results' in results:
                print(f"Found additional results for search term: {search_term}")
                # Add the search term itself if jobs were found
                if not any(i.lower() == search_term.lower() for i in industries):
                    industries.append(search_term.title())
        
        return jsonify({
            "success": True,
            "industries": industries
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/trending-jobs', methods=['GET'])
def get_trending_jobs():
    try:
        industry = request.args.get('industry', '')
        search_term = request.args.get('searchTerm', '').lower()
        user_location = request.args.get('location', 'United States')
        
        print(f"\n=== Getting Jobs for industry: '{industry}', search: '{search_term}' ===")
        
        # Get base jobs from API
        jobs = get_trending_jobs_serp(industry, user_location)
        
        # If there's a search term, filter and search for it
        if search_term:
            # Filter existing jobs
            filtered_jobs = [job for job in jobs if search_term in job.lower()]
            
            # Search for new jobs with the term
            params = {
                "api_key": SERP_API_KEY,
                "engine": "google_jobs",
                "q": f"{search_term} {industry}",
                "location": format_location(user_location),
                "hl": "en",
                "gl": "us",
                "chips": "date_posted:today"
            }
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            if 'jobs_results' in results:
                print(f"Found additional results for search term: {search_term}")
                new_jobs = [job['title'] for job in results.get('jobs_results', [])]
                # Combine filtered existing jobs with new jobs
                jobs = list(set(filtered_jobs + new_jobs))
        
        return jsonify({
            "success": True,
            "jobs": jobs
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/trending-skills', methods=['GET'])
def get_trending_skills():
    try:
        job_title = request.args.get('jobTitle', '')
        industry = request.args.get('industry', '')
        user_location = request.args.get('location', 'United States')
        
        print(f"\n=== Getting Trending Skills ===")
        print(f"Job Title: {job_title}")
        print(f"Industry: {industry}")
        print(f"Location: {user_location}")
        
        skills = get_trending_skills_serp(job_title, industry, user_location)
        
        # Ensure we're returning a valid response
        if not skills:
            skills = get_default_skills(job_title, industry)
        
        print(f"Returning skills: {skills}")
        
        return jsonify({
            "success": True,
            "skills": skills
        })
        
    except Exception as e:
        print(f"Error in get_trending_skills: {str(e)}")
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

def clean_skill_name(skill):
    """Clean and validate a skill name"""
    if not skill or len(skill) < 3:
        return None
        
    # Remove common prefixes/suffixes
    skill = re.sub(r'^(strong|proven|demonstrated|excellent|advanced|basic|proficient|experience with|experience in|ability to|knowledge of)\s+', '', skill.strip(), flags=re.IGNORECASE)
    
    # Remove common suffixes
    skill = re.sub(r'\s+(skills|experience|knowledge|proficiency|expertise)$', '', skill, flags=re.IGNORECASE)
    
    # Remove any remaining parentheses and their contents
    skill = re.sub(r'\(.*?\)', '', skill)
    
    # Clean up whitespace and punctuation
    skill = re.sub(r'[^\w\s-]', '', skill)
    skill = ' '.join(skill.split())
    
    # Title case the skill
    skill = skill.title()
    
    # Validate the cleaned skill
    if len(skill) < 3 or len(skill) > 50:
        return None
    
    # Skip if it's just a number or common words
    if skill.isdigit() or skill.lower() in {'the', 'and', 'or', 'in', 'at', 'to', 'for', 'of', 'with'}:
        return None
        
    return skill

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

def test_location_format(location):
    """Test function to try different location formats"""
    try:
        print(f"\n=== Testing Location Format ===")
        print(f"Original location: {location}")
        
        # Test different formats
        formats = {
            'original': location,
            'state_only': location.split(',')[1].strip() if ',' in location else location,
            'state_code': location.split(',')[1].strip() if ',' in location else location,
            'california': 'California',  # Test with full state name
            'ca': 'CA',  # Test with state code
            'usa': 'USA'
        }
        
        for format_name, test_location in formats.items():
            print(f"\nTrying format: {format_name}")
            params = {
                "api_key": SERP_API_KEY,
                "engine": "google_jobs",
                "q": "jobs",
                "location": test_location,
                "hl": "en",
                "gl": "us",
                "chips": "date_posted:today"
            }
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            success = 'error' not in results
            print(f"Location: {test_location}")
            print(f"Success: {success}")
            if not success:
                print(f"Error: {results.get('error')}")
            else:
                print(f"Got {len(results.get('jobs_results', []))} results")
                
        return formats
        
    except Exception as e:
        print(f"Test error: {str(e)}")
        return None

def get_trending_industries_serp(search_term='', location='United States'):
    try:
        print(f"\n=== Getting Trending Industries ===")
        print(f"Original location: {location}")
        
        formatted_location = format_location(location)
        print(f"Formatted location: {formatted_location}")
        
        # If there's a search term, use it to filter industries
        if search_term:
            # First try to match against our known industries
            known_industries = {
                'technology': 'Technology',
                'healthcare': 'Healthcare',
                'finance': 'Finance',
                'education': 'Education',
                'manufacturing': 'Manufacturing',
                'retail': 'Retail',
                'entertainment': 'Entertainment',
                'construction': 'Construction',
                'transportation': 'Transportation',
                'hospitality': 'Hospitality',
                'software': 'Technology',
                'medical': 'Healthcare',
                'banking': 'Finance',
                'engineering': 'Engineering',
                'marketing': 'Marketing',
                'sales': 'Sales',
                'media': 'Media',
                'energy': 'Energy',
                'automotive': 'Automotive',
                'consulting': 'Consulting'
            }
            
            # Filter known industries based on search term
            matching_industries = [
                value for key, value in known_industries.items()
                if search_term.lower() in key
            ]
            if matching_industries:
                return matching_industries
        
        # For empty search or no matches, get trending industries from Google
        params = {
            "api_key": SERP_API_KEY,
            "engine": "google_jobs",
            "q": "top industries hiring careers",
            "location": formatted_location,
            "hl": "en",
            "gl": "us",
            "chips": "date_posted:today"
        }
        
        print(f"Search params: {params}")
        search = GoogleSearch(params)
        results = search.get_dict()
        
        industries = set()
        
        if 'jobs_results' in results:
            for job in results['jobs_results']:
                # Extract from description
                if 'description' in job:
                    desc = job['description'].lower()
                    # Look for industry keywords
                    for industry in INDUSTRY_KEYWORDS:
                        if industry.lower() in desc:
                            industries.add(industry)
                
                # Extract from company info
                if 'company_name' in job:
                    company = job['company_name'].lower()
                    for industry in INDUSTRY_KEYWORDS:
                        if industry.lower() in company:
                            industries.add(industry)
        
        # If we don't have enough industries, add common ones
        if len(industries) < 5:
            industries.update([
                'Technology',
                'Healthcare',
                'Finance',
                'Education',
                'Manufacturing',
                'Retail',
                'Entertainment'
            ])
        
        final_industries = sorted(list(industries))[:10]
        print(f"Final industries list: {final_industries}")
        return final_industries

    except Exception as e:
        print(f"Error in get_trending_industries_serp: {str(e)}")
        return ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing']

def get_trending_jobs_serp(industry, location='United States'):
    try:
        print(f"\n=== Getting Trending Jobs ===")
        print(f"Industry: {industry}")
        print(f"Original location: {location}")
        
        formatted_location = format_location(location)
        print(f"Formatted location: {formatted_location}")
        
        params = {
            "api_key": SERP_API_KEY,
            "engine": "google_jobs",
            "q": f"{industry} jobs",
            "location": formatted_location,
            "hl": "en",
            "gl": "us",
            "chips": "date_posted:today"
        }
        
        print(f"Search params: {params}")
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        if 'error' in results:
            print(f"SERP API error: {results.get('error')}")
            return get_default_jobs(industry)
        
        # Extract job titles
        job_titles = []
        for job in results.get('jobs_results', []):
            title = clean_job_title(job.get('title', ''))
            if title:
                job_titles.append(title)
        
        # Get most common job titles
        job_counts = Counter(job_titles)
        top_jobs = [job for job, _ in job_counts.most_common(10)]
        
        if not top_jobs:
            return get_default_jobs(industry)
        
        print(f"Final jobs list: {top_jobs}")
        return top_jobs

    except Exception as e:
        print(f"Error in get_trending_jobs_serp: {str(e)}")
        print(f"Full traceback: {traceback.format_exc()}")
        return get_default_jobs(industry)

def get_trending_skills_serp(job_title, industry, location='United States'):
    try:
        print(f"\n=== Getting Trending Skills ===")
        print(f"Job Title: {job_title}")
        print(f"Industry: {industry}")
        print(f"Location: {location}")

        # First try to get skills from SERP API
        params = {
            "api_key": SERP_API_KEY,
            "engine": "google_jobs",
            "q": f"{job_title} skills requirements",  # Simplified search query
            "location": format_location(location),
            "hl": "en",
            "gl": "us"
        }

        print("Querying SERP API with params:", params)
        search = GoogleSearch(params)
        results = search.get_dict()
        
        skills_set = set()
        
        if 'error' not in results and 'jobs_results' in results:
            jobs = results.get('jobs_results', [])
            print(f"Found {len(jobs)} job results")
            
            for job in jobs:
                description = job.get('description', '').lower()
                
                # Extract skills from requirements/qualifications sections
                skill_patterns = [
                    r'(?:requirements|qualifications|skills required|what you\'ll need)[:]\s*(.*?)(?=\n\n|\Z)',
                    r'(?:•|\*)\s*([\w\s]+)',  # Bullet points
                    r'(?:proficiency|experience) (?:in|with)\s+([\w\s,]+)',
                    r'knowledge of\s+([\w\s,]+)',
                    r'(\w+) skills'
                ]
                
                for pattern in skill_patterns:
                    matches = re.finditer(pattern, description, re.IGNORECASE | re.DOTALL)
                    for match in matches:
                        skill_text = match.group(1)
                        # Split by common delimiters
                        for skill in re.split(r'[,;.]', skill_text):
                            cleaned_skill = clean_skill_name(skill)
                            if cleaned_skill:
                                skills_set.add(cleaned_skill)
                                print(f"Found skill: {cleaned_skill}")

        # If we found skills from SERP API, use them
        if len(skills_set) >= 5:
            print(f"Using {len(skills_set)} skills found from SERP API")
            final_skills = list(skills_set)
            random.shuffle(final_skills)
            return final_skills[:15]

        print("Not enough skills found from SERP API, using industry-specific fallback")
        
        # Industry-specific skills as fallback
        industry_skills = {
            'Education': [
                'Curriculum Development', 'Instructional Design', 'Student Assessment',
                'Educational Technology', 'Classroom Management', 'Lesson Planning',
                'Learning Management Systems', 'Student Engagement', 'Educational Leadership',
                'Special Education', 'Teaching Methods', 'Academic Advising',
                'Educational Psychology', 'Distance Learning', 'Student Support'
            ],
            'Technology': [
                'Programming', 'Software Development', 'Cloud Computing',
                'Database Management', 'System Architecture', 'Agile Methodology',
                'DevOps', 'Cybersecurity', 'Network Administration',
                'API Development', 'Version Control', 'Web Development'
            ],
            'Finance': [
                'Financial Analysis', 'Financial Modeling', 'Budgeting',
                'Forecasting', 'Risk Management', 'Investment Analysis',
                'Financial Reporting', 'Accounting', 'Business Analysis',
                'Financial Planning', 'Cost Analysis', 'Banking'
            ]
        }

        # Common professional skills
        common_skills = [
            'Project Management', 'Leadership', 'Communication',
            'Problem Solving', 'Team Collaboration', 'Time Management',
            'Strategic Planning', 'Critical Thinking', 'Organization',
            'Presentation Skills', 'Research', 'Data Analysis'
        ]

        # Combine industry-specific and common skills
        all_skills = industry_skills.get(industry, []) + common_skills
        random.shuffle(all_skills)
        
        final_skills = list(dict.fromkeys(all_skills))[:15]
        print(f"Returning fallback skills: {final_skills}")
        return final_skills

    except Exception as e:
        print(f"Error in get_trending_skills_serp: {str(e)}")
        traceback.print_exc()
        return get_default_skills(job_title, industry)

# Helper functions for default values
def get_default_jobs(industry):
    default_jobs = {
        'Technology': ['Software Engineer', 'Data Scientist', 'IT Support', 'System Administrator', 
                      'DevOps Engineer', 'Product Manager', 'QA Engineer', 'Network Engineer', 
                      'Business Analyst', 'Project Manager'],
        'Healthcare': ['Registered Nurse', 'Medical Assistant', 'Physician', 'Nurse Practitioner',
                      'Physical Therapist', 'Healthcare Administrator', 'Medical Technologist',
                      'Pharmacist', 'Dental Hygienist', 'Medical Records Specialist'],
        # Add more industries as needed
    }
    return default_jobs.get(industry, [
        'Project Manager', 'Business Analyst', 'Operations Manager',
        'Sales Representative', 'Marketing Manager', 'Account Manager',
        'Administrative Assistant', 'Customer Service Representative',
        'Human Resources Manager', 'Financial Analyst'
    ])

def get_default_skills(job_title, industry):
    return [
        'Communication', 'Problem Solving', 'Team Collaboration',
        'Project Management', 'Data Analysis', 'Microsoft Office',
        'Customer Service', 'Leadership', 'Time Management',
        'Critical Thinking'
    ]

# Add these constants at the top of your file
INDUSTRY_KEYWORDS = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Entertainment',
    'Construction',
    'Transportation',
    'Hospitality',
    'Engineering',
    'Marketing',
    'Sales',
    'Media',
    'Energy',
    'Automotive',
    'Consulting',
    'Real Estate',
    'Agriculture',
    'Telecommunications'
]

SKILL_KEYWORDS = [
    'Python', 'Java', 'JavaScript', 'SQL', 'AWS', 'Azure', 'Docker',
    'Kubernetes', 'React', 'Angular', 'Node.js', 'Machine Learning',
    'Data Analysis', 'Project Management', 'Agile', 'Scrum',
    'Communication', 'Leadership', 'Problem Solving', 'Team Collaboration',
    # Add more skills as needed
]

# Add this new route after your other routes
@app.route('/suggest-industries', methods=['GET', 'POST'])
def suggest_industries():
    try:
        # Handle both GET and POST requests
        if request.method == 'GET':
            search_term = request.args.get('searchTerm', '').lower()
        else:
            search_term = request.json.get('searchText', '').lower()
        
        # Filter industries based on search term
        filtered_industries = [
            industry for industry in INDUSTRY_KEYWORDS
            if not search_term or search_term in industry.lower()
        ]
        
        # Add trending industries from Google Jobs API if available
        try:
            location = request.args.get('location', 'United States')
            trending_industries = get_trending_industries_serp(search_term, location)
            # Combine and remove duplicates
            all_industries = list(set(filtered_industries + trending_industries))
        except:
            all_industries = filtered_industries
        
        return jsonify({
            "success": True,
            "industries": all_industries[:15]  # Limit to 15 suggestions
        })
    except Exception as e:
        print(f"Error in suggest-industries: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Add this new route for job type suggestions
@app.route('/suggest-jobs', methods=['GET', 'POST'])
def suggest_jobs():
    try:
        if request.method == 'GET':
            industry = request.args.get('industry', '').strip()
            search_term = request.args.get('searchTerm', '').strip()
            location = request.args.get('location', 'United States')
        else:
            data = request.json
            industry = data.get('industry', '').strip()
            search_term = data.get('searchText', '').strip()
            location = data.get('location', 'United States')

        print(f"\n=== Getting Jobs for industry: '{industry}', search: '{search_term}' ===")

        # Use SERP API to get job suggestions
        params = {
            "api_key": SERP_API_KEY,
            "engine": "google_jobs",
            "q": f"{search_term} {industry} jobs" if search_term else f"{industry} jobs",
            "location": format_location(location),
            "hl": "en",
            "gl": "us",
            "chips": "date_posted:today"
        }

        search = GoogleSearch(params)
        results = search.get_dict()

        if 'error' in results:
            print(f"SERP API error: {results.get('error')}")
            return jsonify({
                "success": True,
                "jobs": get_default_jobs(industry)
            })

        # Extract and clean job titles
        job_titles = []
        seen_titles = set()
        
        for job in results.get('jobs_results', []):
            title = clean_job_title(job.get('title', ''))
            if title and title not in seen_titles:
                seen_titles.add(title)
                job_titles.append(title)

        # If no results, use default jobs
        if not job_titles:
            job_titles = get_default_jobs(industry)

        # Limit to 15 suggestions
        job_titles = job_titles[:15]
        
        print(f"Returning job titles: {job_titles}")

        return jsonify({
            "success": True,
            "jobs": job_titles
        })
    except Exception as e:
        print(f"Error in suggest-jobs: {str(e)}")
        traceback.print_exc()  # Print full traceback
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/reverse-geocode', methods=['GET'])
def reverse_geocode():
    try:
        lat = request.args.get('lat')
        lng = request.args.get('lng')
        
        if not lat or not lng:
            return jsonify({
                "success": False,
                "error": "Missing latitude or longitude"
            }), 400

        search = GoogleSearch({
            "engine": "google_maps_reverse_geocoding",
            "lat": lat,
            "lng": lng,
            "type": "address",
            "api_key": os.getenv('SERP_API_KEY')
        })
        
        result = search.get_dict()
        
        if 'place_results' in result:
            address_components = result['place_results'].get('address_components', [])
            
            city = next((comp['long_name'] for comp in address_components 
                        if 'locality' in comp['types']), None)
            state = next((comp['short_name'] for comp in address_components 
                         if 'administrative_area_level_1' in comp['types']), None)

            return jsonify({
                "success": True,
                "city": city,
                "state": state
            })
        
        return jsonify({
            "success": False,
            "error": "No results found"
        }), 404

    except Exception as e:
        print(f"Error in reverse-geocode: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 