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
import math
import spacy
import openai
import googlemaps
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

lock = threading.Lock()
last_request_time = datetime.now() - timedelta(seconds=60)  # Initialize to allow immediate first request

# Global variables for rate limiting and caching
trends_cache = {}
trends_cache_time = None
cache_duration = timedelta(minutes=30)

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("Warning: OpenAI API key not found in environment variables")
    
client = OpenAI()

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

# Load the English language model
nlp = spacy.load('en_core_web_md')

# Add after other environment variables
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY) if GOOGLE_MAPS_API_KEY else None

# Initialize BERT model 
# Alternative: 'all-mpnet-base-v2' for higher accuracy but slower
print("Loading BERT model...")
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
print("BERT model loaded successfully")

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

def calculate_semantic_similarity(text1, text2, context=None):
    """
    Calculate semantic similarity using BERT embeddings with fallback
    """
    try:
        # Check if model is available
        if 'model' not in globals():
            print("BERT model not available, falling back to basic matching")
            return basic_text_similarity(text1, text2)
            
        # Prepare texts with context
        if context:
            text1 = f"{context}: {text1}"
            text2 = f"{context}: {text2}"
        
        # Get embeddings
        embedding1 = model.encode([text1])[0]
        embedding2 = model.encode([text2])[0]
        
        # Calculate cosine similarity
        similarity = cosine_similarity(
            embedding1.reshape(1, -1), 
            embedding2.reshape(1, -1)
        )[0][0]
        
        print(f"Similarity between '{text1}' and '{text2}': {similarity}")
        return float(similarity)
        
    except Exception as e:
        print(f"Error in semantic similarity calculation: {e}")
        return basic_text_similarity(text1, text2)

def basic_text_similarity(text1, text2):
    """Fallback similarity calculation using basic text matching"""
    text1 = set(text1.lower().split())
    text2 = set(text2.lower().split())
    
    if not text1 or not text2:
        return 0.0
        
    intersection = text1.intersection(text2)
    union = text1.union(text2)
    
    return len(intersection) / len(union)

def analyze_pay_range(job_pay, user_prefs):
    """Analyze pay range compatibility"""
    try:
        job_min = float(job_pay.get('min', 0))
        job_max = float(job_pay.get('max', 0))
        user_min = float(user_prefs.get('min', 0))
        
        if job_max >= user_min:
            # Higher pay gets higher score
            return min(1.0, (job_max - user_min) / (user_min * 0.5))
        return 0.0
    except:
        return 0.0

@app.route('/analyze-job-match', methods=['POST'])
def analyze_job_match():
    try:
        data = request.json
        job_data = data.get('job', {})
        user_data = data.get('user', {})
        
        # Initialize score components
        title_score = 0.0
        industry_score = 0.0
        skills_score = 0.0
        overview_score = 0.0
        pay_score = 0.0
        
        # 1. Job Title Match (25%)
        if job_data.get('jobTitle') and user_data.get('selectedJobs'):
            title_similarities = [
                calculate_semantic_similarity(
                    job_data['jobTitle'],
                    user_job.get('title', '')
                )
                for user_job in user_data['selectedJobs']
            ]
            title_score = max(title_similarities) if title_similarities else 0.0
        
        # 2. Industry Match (20%)
        if job_data.get('industry') and user_data.get('industryPrefs'):
            # Check both industry and industryPrefs arrays
            all_user_industries = user_data['industryPrefs']
            industry_similarities = [
                calculate_semantic_similarity(
                    job_data['industry'],
                    industry
                )
                for industry in all_user_industries
            ]
            industry_score = max(industry_similarities) if industry_similarities else 0.0
        
        # 3. Skills Match (25%)
        if job_data.get('requiredSkills') and user_data.get('selectedJobs'):
            all_user_skills = []
            for job in user_data['selectedJobs']:
                all_user_skills.extend(job.get('skills', []))
            
            skill_scores = []
            for req_skill in job_data['requiredSkills']:
                skill_name = req_skill.get('name', '')
                skill_years = req_skill.get('yearsOfExperience', 0)
                
                skill_similarities = [
                    calculate_semantic_similarity(
                        skill_name,
                        user_skill
                    )
                    for user_skill in all_user_skills
                ]
                max_similarity = max(skill_similarities) if skill_similarities else 0.0
                skill_scores.append(max_similarity)
            
            skills_score = sum(skill_scores) / len(skill_scores) if skill_scores else 0.0
        
        # 4. Overview Match (15%)
        if job_data.get('job_overview') and user_data.get('overviewResponses'):
            # Combine all overview responses into a single string
            user_overview = ' '.join(user_data['overviewResponses'].values())
            overview_score = calculate_semantic_similarity(
                job_data['job_overview'],
                user_overview
            )
        
        # 5. Pay Range Analysis (15%)
        if job_data.get('estPayRangeMin') is not None and job_data.get('estPayRangeMax') is not None:
            base_pay = {
                'min': job_data['estPayRangeMin'],
                'max': job_data['estPayRangeMax']
            }
            
            # Include tips in total compensation if available
            if job_data.get('estTipRangeMin') is not None and job_data.get('estTipRangeMax') is not None:
                base_pay['min'] += job_data['estTipRangeMin']
                base_pay['max'] += job_data['estTipRangeMax']
            
            pay_score = analyze_pay_range(base_pay, {})  # No user pay preferences needed
        
        # Calculate weighted total score
        total_score = (
            title_score * 0.25 +
            industry_score * 0.20 +
            skills_score * 0.25 +
            overview_score * 0.15 +
            pay_score * 0.15
        ) * 100  # Convert to 0-100 scale
        
        return jsonify({
            "success": True,
            "score": round(total_score, 2),
            "components": {
                "titleMatch": round(title_score * 100, 2),
                "industryMatch": round(industry_score * 100, 2),
                "skillsMatch": round(skills_score * 100, 2),
                "overviewMatch": round(overview_score * 100, 2),
                "payMatch": round(pay_score * 100, 2)
            }
        })
        
    except Exception as e:
        print(f"Error in analyze-job-match: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
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

@app.route('/suggest-skills', methods=['GET'])
def suggest_skills():
    try:
        job_title = request.args.get('jobTitle', '')
        industry = request.args.get('industry', '')
        location = request.args.get('location', '')
        
        print(f"\n=== Getting Skill Suggestions ===")
        print(f"Job Title: {job_title}")
        print(f"Industry: {industry}")
        print(f"Location: {location}")
        
        # First get raw skills from OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a career advisor specializing in identifying key skills for specific jobs.
                    For the given job title and industry, list the top 10 most relevant and in-demand skills.
                    Include both technical and soft skills where appropriate.
                    Return only the skills as a comma-separated list, without numbers or explanations.
                    
                    IMPORTANT:
                    - List only actual skills (not benefits, responsibilities, or requirements)
                    - Keep skills concise (1-3 words)
                    - Focus on core competencies
                    - Avoid listing tools or specific software unless crucial
                    """
                },
                {
                    "role": "user",
                    "content": f"What are the most important skills for a {job_title} in the {industry} industry?"
                }
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        # Parse the initial skills
        raw_skills = [skill.strip() for skill in response.choices[0].message.content.split(',')]
        print(f"Raw skills: {raw_skills}")
        
        # Normalize each skill
        normalized_skills = []
        for skill in raw_skills:
            try:
                # Use OpenAI to normalize each skill
                normalize_response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a skill normalizer. Your task is to:
                            1. Convert the input into a proper skill if possible
                            2. Remove any non-skill items (benefits, requirements, etc.)
                            3. Keep only 1-3 word core skills
                            4. Return only the normalized skill name or REMOVE if not a valid skill
                            
                            Examples:
                            - "Vision Insurance Compensation Package" -> "REMOVE"
                            - "Remote Work Noemployment Type Fulltime" -> "REMOVE"
                            - "Perform A Variety Of Other Duties" -> "REMOVE"
                            - "Customer Service Experience For Job Description" -> "Customer Service"
                            - "Leadership Training Programs" -> "Leadership"
                            - "Similar Diesel Equipment And" -> "Equipment Maintenance"
                            - "Perform Fluid Exchanges" -> "Fluid Maintenance"
                            - "Collaborate With Cross" -> "Cross-functional Collaboration"
                            """
                        },
                        {
                            "role": "user",
                            "content": f"Normalize this skill: {skill}"
                        }
                    ],
                    temperature=0,
                    max_tokens=50
                )
                
                normalized_skill = normalize_response.choices[0].message.content.strip()
                if normalized_skill != "REMOVE":
                    normalized_skills.append(normalized_skill)
                print(f"Normalized '{skill}' → '{normalized_skill}'")
                
            except Exception as e:
                print(f"Error normalizing skill: {str(e)}")
                if len(skill) <= 30 and not any(word in skill.lower() for word in ['insurance', 'benefit', 'time off', 'leave']):
                    normalized_skills.append(skill)
        
        # Remove duplicates and sort
        unique_skills = sorted(list(set(normalized_skills)))
        
        # Ensure we have enough skills
        if len(unique_skills) < 5:
            default_skills = [
                "Communication",
                "Problem Solving",
                "Team Work",
                "Project Management",
                "Time Management",
                "Leadership",
                "Analytics",
                "Critical Thinking",
                "Organization",
                "Attention to Detail"
            ]
            unique_skills.extend([s for s in default_skills if s not in unique_skills])
            unique_skills = unique_skills[:10]  # Keep top 10
        
        print(f"Final normalized skills: {unique_skills}")
        
        return jsonify({
            "success": True,
            "skills": unique_skills
        })
        
    except Exception as e:
        print(f"Error in suggest_skills: {str(e)}")
        traceback.print_exc()
        
        # Return default skills on error
        default_skills = [
            "Communication",
            "Problem Solving",
            "Team Work",
            "Project Management",
            "Time Management",
            "Leadership",
            "Analytics",
            "Critical Thinking",
            "Organization",
            "Attention to Detail"
        ]
        
        return jsonify({
            "success": True,
            "skills": default_skills,
            "error": str(e)
        })

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
@app.route('/suggest-jobs', methods=['GET'])
def suggest_jobs():
    try:
        industry = request.args.get('industry', '')
        search_term = request.args.get('searchTerm', '')
        location = request.args.get('location', '')
        
        print(f"\n=== Getting Job Suggestions ===")
        print(f"Industry: {industry}")
        print(f"Search: {search_term}")
        print(f"Location: {location}")
        
        # Get initial job suggestions using your existing function
        raw_jobs = get_trending_jobs_serp(industry, location)
        print(f"Raw jobs: {raw_jobs}")
        
        # Normalize each job title
        normalized_jobs = []
        for job_title in raw_jobs:
            try:
                # Use new OpenAI API format
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a job title normalizer. Your task is to:
                            1. Remove unnecessary details like locations, facility names, shift info, and employment type (PT/FT)
                            2. Remove parentheses and their contents unless essential to the role
                            3. Standardize common variations
                            4. Keep only the core job title
                            5. Return only the simplified title without any explanation
                            
                            Examples:
                            - "Information Technology [It] Support Specialist" -> "IT Support Specialist"
                            - "Lead/Senior Tech - Ca" -> "Senior Technician"
                            - "Information Technology Specialist I" -> "IT Specialist"
                            - "Director Technology Support & Operations" -> "Technology Support Director"
                            """
                        },
                        {
                            "role": "user",
                            "content": f"Normalize this job title: {job_title}"
                        }
                    ],
                    temperature=0,
                    max_tokens=50
                )
                
                normalized_title = response.choices[0].message.content.strip()
                normalized_title = normalized_title.replace('"', '').replace("'", "")
                print(f"Normalized '{job_title}' → '{normalized_title}'")
                normalized_jobs.append(normalized_title)
                
            except Exception as e:
                print(f"Error normalizing job title: {str(e)}")
                normalized_jobs.append(job_title)
        
        # Remove duplicates
        unique_jobs = list(set(normalized_jobs))
        print(f"Final normalized jobs: {unique_jobs}")
        
        return jsonify({
            "success": True,
            "jobs": unique_jobs
        })
        
    except Exception as e:
        print(f"Error in suggest_jobs: {str(e)}")
        traceback.print_exc()
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

def calculate_job_similarity(job1, job2):
    """
    Calculate similarity between two jobs based on their titles
    Returns a score between 0 and 1
    """
    print(f"\n--- Calculating Job Similarity ---")
    print(f"Job 1: {json.dumps(job1, indent=2)}")
    print(f"Job 2: {json.dumps(job2, indent=2)}")
    
    # Check if either job is missing
    if not job1 or not job2:
        print("Missing job data")
        return 0.0
        
    # Get job titles
    title1 = job1.get('title', '').lower()
    title2 = job2.get('title', '').lower()
    
    print(f"Title 1: {title1}")
    print(f"Title 2: {title2}")
    
    if not title1 or not title2:
        print("Missing job titles")
        return 0.0
    
    # Split titles into words and remove common words
    common_words = {'and', 'or', 'the', 'in', 'at', 'of', 'for', 'to', 'with'}
    words1 = set(w for w in title1.split() if w not in common_words)
    words2 = set(w for w in title2.split() if w not in common_words)
    
    print(f"Words from title 1: {words1}")
    print(f"Words from title 2: {words2}")
    
    # Calculate word overlap
    if not words1 or not words2:
        print("No valid words found after filtering")
        return 0.0
        
    common_words = words1.intersection(words2)
    unique_words = words1.union(words2)
    
    similarity = len(common_words) / len(unique_words)
    
    print(f"Common words: {common_words}")
    print(f"All unique words: {unique_words}")
    print(f"Similarity score: {similarity:.2f}")
    
    return similarity

@app.route('/test-backend', methods=['GET'])
def test_backend():
    print("Test endpoint hit!")
    return jsonify({
        "success": True,
        "message": "Backend is working"
    })

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters using Haversine formula"""
    if not all([lat1, lon1, lat2, lon2]):
        return 0
        
    R = 6371000  # Earth's radius in meters
    
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    
    # Convert latitude and longitude to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c  # Distance in meters

def calculate_distance_score(user_location, item_location, max_distance=50000):
    """Calculate a score between 0-30 based on distance between locations"""
    try:
        if not user_location or not item_location:
            return 0
            
        # Calculate distance in meters using the existing calculate_distance function
        distance = calculate_distance(
            user_location['latitude'],
            user_location['longitude'],
            item_location['latitude'],
            item_location['longitude']
        )
        
        # Convert to a 0-30 score (linear scale)
        score = max(0, (1 - distance/max_distance) * 30)
        
        print(f"Distance: {distance/1000:.2f}km, Score: {score:.2f}/30")
        return score
        
    except Exception as e:
        print(f"Error calculating distance score: {str(e)}")
        return 0

@app.route('/calculate-match', methods=['POST'])
def calculate_match():
    try:
        print("\n=== Calculate Match Request ===")
        data = request.get_json()
        print("Request data:", json.dumps(data, indent=2))
        
        user_data = data.get('userData', {})
        item_data = data.get('itemData', {})
        
        print("\nUser data:", json.dumps(user_data, indent=2))
        print("\nItem data:", json.dumps(item_data, indent=2))
        
        # Calculate job score (40%)
        job_score = calculate_job_score(user_data, item_data)
        print("\nJob score:", job_score)
        
        # Calculate location score (30%)
        location_score = calculate_distance_score(
            user_data.get('location'),
            item_data.get('location')
        )
        print("Location score:", location_score)
        
        # Calculate availability score (30%)
        availability_score = calculate_availability_score(
            user_data.get('availability'),
            item_data.get('availability'),
            user_flexibility=30
        )
        print("Availability score:", availability_score)
        
        total_score = job_score + location_score + availability_score
        print("\nTotal score:", total_score)
        
        response = {
            'score': total_score,
            'jobScore': job_score,
            'locationScore': location_score,
            'availabilityScore': availability_score
        }
        print("\nResponse:", json.dumps(response, indent=2))
        
        return jsonify(response)
        
    except Exception as e:
        print(f"\nError in calculate_match: {str(e)}")
        print("Traceback:", traceback.format_exc())
        return jsonify({'error': str(e)}), 500

def calculate_job_score(user_data, item_data):
    """Calculate job match score with improved context awareness"""
    print("\n=== Calculating Job Score ===")
    print(f"User data: {user_data}")
    print(f"Item data: {item_data}")
    
    max_score = 40
    user_jobs = user_data.get('selectedJobs', [])
    candidate_jobs = item_data.get('selectedJobs', [])
    
    if not user_jobs or not candidate_jobs:
        print("Missing job data")
        return 0
    
    max_job_score = 0
    
    for user_job in user_jobs:
        for candidate_job in candidate_jobs:
            print(f"\nComparing jobs:")
            print(f"User job: {user_job.get('title')}")
            print(f"Candidate job: {candidate_job.get('title')}")
            
            # Title similarity with industry context
            industry_context = user_job.get('industry', '')
            title_sim = calculate_semantic_similarity(
                user_job.get('title', ''),
                candidate_job.get('title', ''),
                context=f"Job title in {industry_context} industry"
            )
            title_score = title_sim * 20
            print(f"Title similarity score: {title_score:.2f}/20")
            
            # Industry similarity
            industry_sim = calculate_semantic_similarity(
                user_job.get('industry', ''),
                candidate_job.get('industry', '')
            )
            industry_score = industry_sim * 10
            print(f"Industry similarity score: {industry_score:.2f}/10")
            
            # Skills match
            skills_score = calculate_skills_similarity(
                user_job.get('skills', []),
                candidate_job.get('skills', []),
                industry_context
            )
            print(f"Skills similarity score: {skills_score:.2f}/10")
            
            total_score = title_score + industry_score + skills_score
            print(f"Total job score: {total_score:.2f}/40")
            
            max_job_score = max(max_job_score, total_score)
    
    print(f"\nFinal job score: {max_job_score:.2f}/40")
    return max_job_score

def calculate_skills_similarity(user_skills, candidate_skills, industry_context):
    """Calculate skills similarity with industry context"""
    if not user_skills or not candidate_skills:
        return 0
    
    user_skills = [skill.get('name', '').lower() for skill in user_skills]
    candidate_skills = [skill.get('name', '').lower() for skill in candidate_skills]
    
    skills_scores = []
    for user_skill in user_skills:
        skill_scores = [
            calculate_semantic_similarity(
                user_skill, 
                cand_skill,
                context=f"Skill in {industry_context}"
            )
            for cand_skill in candidate_skills
        ]
        skills_scores.append(max(skill_scores))
    
    return (sum(skills_scores) / len(skills_scores)) * 10

@app.route('/normalize-job-title', methods=['POST'])
def normalize_job_title():
    try:
        print("\n=== Normalize Job Title Request ===")
        print(f"Headers: {dict(request.headers)}")
        print(f"Data: {request.get_data(as_text=True)}")
        
        data = request.get_json()
        if not data:
            print("No JSON data received")
            return jsonify({
                "error": "No data provided",
                "normalizedTitle": None
            }), 400
            
        job_title = data.get('jobTitle', '')
        print(f"\nProcessing job title: {job_title}")

        if not job_title:
            print("No job title provided")
            return jsonify({
                "error": "No job title provided",
                "normalizedTitle": None
            }), 400

        # Call OpenAI to normalize the job title
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a job title normalizer. Your task is to:
                    1. Remove unnecessary details like locations, facility names, shift info, and employment type (PT/FT)
                    2. Remove parentheses and their contents unless essential to the role
                    3. Standardize common variations
                    4. Keep only the core job title
                    5. Return only the simplified title without any explanation
                    
                    Examples:
                    - "Information Technology [It] Support Specialist" -> "IT Support Specialist"
                    - "Lead/Senior Tech - Ca" -> "Senior Technician"
                    - "Information Technology Specialist I" -> "IT Specialist"
                    - "Director Technology Support & Operations" -> "Technology Support Director"
                    """
                },
                {
                    "role": "user",
                    "content": f"Normalize this job title: {job_title}"
                }
            ],
            temperature=0,
            max_tokens=50
        )

        normalized_title = response.choices[0].message.content.strip()
        normalized_title = normalized_title.replace('"', '').replace("'", "")
        
        print(f"Successfully normalized: '{job_title}' → '{normalized_title}'")
        
        return jsonify({
            "originalTitle": job_title,
            "normalizedTitle": normalized_title
        })

    except Exception as e:
        print(f"Error normalizing job title: {str(e)}")
        return jsonify({
            "error": str(e),
            "originalTitle": job_title,
            "normalizedTitle": job_title
        }), 500

@app.route('/suggest-salary', methods=['GET'])
def suggest_salary():
    try:
        job_title = request.args.get('jobTitle', '')
        industry = request.args.get('industry', '')
        location = request.args.get('location', '')
        skills = request.args.get('skills', '').split(',')
        
        print(f"\n=== Getting Salary Suggestions ===")
        print(f"Job Title: {job_title}")
        print(f"Industry: {industry}")
        print(f"Location: {location}")
        print(f"Skills: {skills}")

        # Get real job postings from SERP API
        search_query = f"{job_title} jobs in {location}"
        params = {
            "engine": "google_jobs",
            "q": search_query,
            "location": location,
            "hl": "en",
            "api_key": os.getenv('SERP_API_KEY')
        }

        try:
            search = GoogleSearch(params)
            results = search.get_dict()
            jobs_list = results.get("jobs_results", [])
            
            # Extract salary information from job postings
            salary_data = []
            for job in jobs_list:
                if "salary" in job:
                    salary_info = job["salary"]
                    # Convert salary to hourly if needed
                    try:
                        # Extract min and max from the salary string
                        salary_text = salary_info.get("text", "").lower()
                        
                        # Skip if no clear salary information
                        if not any(term in salary_text for term in ['hour', 'hr', 'year', 'yr', 'month', 'mo']):
                            continue
                            
                        # Extract numbers from the string
                        numbers = re.findall(r'\d+\.?\d*', salary_text)
                        if len(numbers) >= 2:
                            min_sal = float(numbers[0])
                            max_sal = float(numbers[1])
                            
                            # Convert to hourly rate if needed
                            if 'year' in salary_text or 'yr' in salary_text:
                                min_sal = min_sal / (52 * 40)  # Convert yearly to hourly
                                max_sal = max_sal / (52 * 40)
                            elif 'month' in salary_text or 'mo' in salary_text:
                                min_sal = min_sal / (4 * 40)   # Convert monthly to hourly
                            
                            salary_data.append({
                                "min": min_sal,
                                "max": max_sal
                            })
                    except Exception as e:
                        print(f"Error parsing salary: {str(e)}")
                        continue

            print(f"Found {len(salary_data)} salary data points")
            
            # Calculate average ranges from real job postings
            if salary_data:
                avg_min = sum(s["min"] for s in salary_data) / len(salary_data)
                avg_max = sum(s["max"] for s in salary_data) / len(salary_data)
                print(f"Average salary range from postings: ${avg_min:.2f} - ${avg_max:.2f}/hr")
            else:
                avg_min = None
                avg_max = None
                print("No salary data found in job postings")

        except Exception as e:
            print(f"Error fetching SERP data: {str(e)}")
            avg_min = None
            avg_max = None

        # Use OpenAI to analyze and suggest salary range
        prompt_content = f"""Suggest an hourly pay range for:
        Job: {job_title}
        Industry: {industry}
        Location: {location}
        Skills: {', '.join(skills)}
        """
        
        if avg_min is not None and avg_max is not None:
            prompt_content += f"\nMarket data shows an average range of ${avg_min:.2f} - ${avg_max:.2f}/hr in this area."

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a compensation analyst specializing in salary recommendations.
                    Analyze the provided information and market data to suggest a realistic hourly pay range.
                    Consider:
                    1. Local market rates (if provided)
                    2. Industry standards
                    3. Required skills
                    4. Geographic location
                    5. Current market conditions
                    
                    Return the response in JSON format with these fields:
                    {
                        "minPay": number (hourly rate),
                        "maxPay": number (hourly rate),
                        "explanation": string (brief explanation including market data if available)
                    }
                    """
                },
                {
                    "role": "user",
                    "content": prompt_content
                }
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        # Parse the response
        suggestion = response.choices[0].message.content.strip()
        salary_data = json.loads(suggestion)
        
        # Add market data to the response
        if avg_min is not None and avg_max is not None:
            salary_data["marketData"] = {
                "avgMin": round(avg_min, 2),
                "avgMax": round(avg_max, 2)
            }
        
        print(f"Final salary suggestion: {salary_data}")
        
        return jsonify({
            "success": True,
            "salary": salary_data
        })
        
    except Exception as e:
        print(f"Error in suggest_salary: {str(e)}")
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/travel-times', methods=['GET'])
def get_travel_times():
    try:
        # Get parameters from request
        origin_lat = request.args.get('origin_lat')
        origin_lng = request.args.get('origin_lng')
        dest_lat = request.args.get('dest_lat')
        dest_lng = request.args.get('dest_lng')
        arrival_time = request.args.get('arrival_time')

        if not all([origin_lat, origin_lng, dest_lat, dest_lng]):
            return jsonify({
                "success": False,
                "error": "Missing coordinates"
            }), 400

        # Format coordinates
        origin = f"{origin_lat},{origin_lng}"
        destination = f"{dest_lat},{dest_lng}"

        # Set up SERP API parameters
        base_params = {
            "engine": "google_maps_directions",
            "api_key": SERP_API_KEY,
            "origin": origin,
            "destination": destination,
            "hl": "en"
        }

        # Get directions for different modes
        modes = ['driving', 'transit', 'walking']
        results = {}

        for mode in modes:
            try:
                params = base_params.copy()
                params["travel_mode"] = mode
                if arrival_time and mode != 'walking':
                    params["arrival_time"] = arrival_time

                search = GoogleSearch(params)
                data = search.get_dict()

                if 'directions' in data and data['directions']:
                    route = data['directions'][0]  # Get first route
                    leg = route['legs'][0]  # Get first leg
                    
                    results[mode] = {
                        'duration': leg.get('duration', {}).get('text', 'N/A'),
                        'distance': leg.get('distance', {}).get('text', 'N/A')
                    }
                else:
                    results[mode] = {
                        'duration': 'N/A',
                        'distance': 'N/A'
                    }

            except Exception as e:
                print(f"Error getting {mode} directions: {str(e)}")
                results[mode] = {
                    'duration': 'N/A',
                    'distance': 'N/A'
                }

        return jsonify({
            "success": True,
            "travel_times": results
        })

    except Exception as e:
        print(f"Error in get_travel_times: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def truncate_text(text, max_length=200):
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."

@app.route('/analyze-job-fit', methods=['POST'])
def analyze_job_fit():
    try:
        data = request.json
        job_data = data.get('job', {})
        user_data = data.get('user', {})

        # Gather all the analysis points
        job_skills = [s.get('name') if isinstance(s, dict) else s for s in job_data.get('requiredSkills', [])]
        user_skills = user_data.get('skills', [])
        
        # Calculate distance if locations are available
        distance_text = "N/A"
        if 'location' in job_data and 'location' in user_data:
            distance = calculate_distance(
                user_data['location']['latitude'],
                user_data['location']['longitude'],
                job_data['location']['latitude'],
                job_data['location']['longitude']
            )
            distance_text = f"{distance:.1f}"

        # Build job details
        job_title = job_data.get('jobTitle', 'this position')
        company_name = job_data.get('companyName', 'the company')
        pay_min = job_data.get('estPayRangeMin', 0)
        pay_max = job_data.get('estPayRangeMax', 0)
        user_min_pay = user_data.get('payRangeMin', 0)

        # Construct the prompt
        prompt = (
            "Analyze this job match and provide insights in a conversational, natural tone:\n\n"
            "Job Details:\n"
            f"- Title: {job_title} at {company_name}\n"
            f"- Required Skills: {', '.join(job_skills)}\n"
            f"- Pay Range: ${pay_min}-${pay_max}/hr\n\n"
            "Candidate Details:\n"
            f"- Skills: {', '.join(user_skills)}\n"
            f"- Minimum Pay: ${user_min_pay}/hr\n"
            f"- Distance to job: {distance_text} miles\n\n"
            "Please analyze this match and provide:\n"
            "1. A list of pros (advantages and good matches)\n"
            "2. A list of cons (potential challenges or mismatches)\n"
            "3. A brief, natural-sounding summary of the overall fit\n\n"
            "Format the response as a JSON object with these keys:\n"
            "{\n"
            '    "pros": ["detailed pro point 1", "detailed pro point 2", ...],\n'
            '    "cons": ["detailed con point 1", "detailed con point 2", ...],\n'
            '    "summary": "natural language summary"\n'
            "}\n\n"
            "Make the analysis sound conversational and personalized, avoiding repetitive patterns."
        )

        # Get detailed analysis first
        detailed_response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a helpful job match analyst providing insights about job opportunities. Focus on providing detailed, personalized analysis."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=500
        )

        # Parse the detailed response
        detailed_analysis = json.loads(detailed_response.choices[0].message.content.strip())

        # Create a summarization prompt
        summary_prompt = f"""
        Create concise, natural-sounding summaries (maximum 150 characters each) of the following pros and cons for a job match:

        PROS:
        {'; '.join(detailed_analysis['pros'])}

        CONS:
        {'; '.join(detailed_analysis['cons'])}

        Please provide the response in JSON format:
        {{
            "pros_summary": "brief natural summary of pros",
            "cons_summary": "brief natural summary of cons"
        }}

        Each summary should capture the key points while maintaining a natural, flowing tone.
        """

        # Get condensed summaries
        summary_response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise summarizer. Create natural-sounding summaries that maintain key information while staying under 150 characters."
                },
                {
                    "role": "user",
                    "content": summary_prompt
                }
            ],
            temperature=0.7,
            max_tokens=200
        )

        # Parse the summary response
        summaries = json.loads(summary_response.choices[0].message.content.strip())
        
        analysis = {
            "condensed": {
                "pros": summaries["pros_summary"],
                "cons": summaries["cons_summary"],
                "summary": detailed_analysis["summary"]
            },
            "full": detailed_analysis
        }
        
        return jsonify({
            "success": True,
            "analysis": analysis
        })

    except Exception as e:
        print(f"Error in analyze_job_fit: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

class TimeSlot:
    def __init__(self, start_time, end_time, flexibility_minutes=0):
        self.start_time = self._parse_time(start_time)
        self.end_time = self._parse_time(end_time)
        self.flexibility = timedelta(minutes=flexibility_minutes)
    
    def _parse_time(self, time_str):
        hours, minutes = map(int, time_str.split(':'))
        return datetime.now().replace(hour=hours, minute=minutes)
    
    def get_flexible_range(self):
        return (
            self.start_time - self.flexibility,
            self.end_time + self.flexibility
        )

def calculate_availability_score(user_availability, item_availability):
    """Calculate a score between 0-30 based on schedule overlap"""
    try:
        if not user_availability or not item_availability:
            return 0
            
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        total_overlap = 0
        total_slots = 0
        
        for day in days:
            user_slots = user_availability.get(day, {}).get('slots', [])
            item_slots = item_availability.get(day, {}).get('slots', [])
            
            if not user_slots or not item_slots:
                continue
                
            # Check each combination of slots for overlap
            day_overlap = 0
            for user_slot in user_slots:
                for item_slot in item_slots:
                    if check_time_overlap(user_slot, item_slot):
                        overlap_minutes = calculate_overlap_minutes(user_slot, item_slot)
                        day_overlap += overlap_minutes
                        
            total_overlap += day_overlap
            total_slots += sum(calculate_slot_minutes(slot) for slot in user_slots)
        
        if total_slots == 0:
            return 0
            
        # Convert to a 0-30 score
        score = min(30, (total_overlap / total_slots) * 30)
        print(f"Availability overlap: {total_overlap} minutes, Score: {score:.2f}/30")
        return score
        
    except Exception as e:
        print(f"Error calculating availability score: {str(e)}")
        return 0

def calculate_overlap_minutes(slot1, slot2):
    """Calculate the number of overlapping minutes between two time slots"""
    start1 = time_to_minutes(slot1['startTime'])
    end1 = time_to_minutes(slot1['endTime'])
    start2 = time_to_minutes(slot2['startTime'])
    end2 = time_to_minutes(slot2['endTime'])
    
    overlap_start = max(start1, start2)
    overlap_end = min(end1, end2)
    
    return max(0, overlap_end - overlap_start)

def calculate_slot_minutes(slot):
    """Calculate the total minutes in a time slot"""
    start = time_to_minutes(slot['startTime'])
    end = time_to_minutes(slot['endTime'])
    return max(0, end - start)

def check_time_overlap(slot1, slot2):
    """Check if two time slots overlap"""
    start1 = time_to_minutes(slot1['startTime'])
    end1 = time_to_minutes(slot1['endTime'])
    start2 = time_to_minutes(slot2['startTime'])
    end2 = time_to_minutes(slot2['endTime'])
    
    return start1 < end2 and end1 > start2

def time_to_minutes(time_str):
    """Convert time string (HH:MM) to minutes since midnight"""
    try:
        hours, minutes = map(int, time_str.split(':'))
        return hours * 60 + minutes
    except:
        return 0

def initialize_bert_model():
    try:
        global model
        print("Initializing BERT model...")
        model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
        # Test the model with a simple example
        test_embedding = model.encode(["test sentence"])
        print("BERT model initialized successfully")
        return True
    except Exception as e:
        print(f"Error initializing BERT model: {e}")
        return False

# Initialize when app starts
if not initialize_bert_model():
    print("WARNING: BERT model failed to initialize. Falling back to basic matching.")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 