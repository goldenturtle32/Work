from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os
from dotenv import load_dotenv
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv('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'))  # Make sure to use env variable

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

@app.route('/analyze-job-match', methods=['POST'])
def analyze_job_match():
    try:
        data = request.json
        job_data = data.get('job', {})
        user_data = data.get('user', {})
        
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a job matching expert providing friendly, detailed analysis."},
                    {"role": "user", "content": f"Analyze this job match. Job: {job_data}, User: {user_data}"}
                ],
                temperature=0.7,
                max_tokens=300
            )
            analysis = response.choices[0].message.content
            
        except Exception as e:
            # If OpenAI fails, use fallback analysis
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

        # Create the prompt
        prompt = f"""Generate 4 relevant questions/messages for a {role} chatting about a {job_title} position at {company}.
        Recent messages in the chat: {recent_messages}
        
        The suggestions should be:
        - Natural and conversational
        - Relevant to the context
        - Professional but friendly
        - Specific to the role/company when possible
        
        Return the suggestions as a JSON array of strings. For example:
        ["What benefits does this position offer?", "Could you describe the team culture?"]"""

        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant generating chat suggestions for a job matching platform."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            suggestions = parse_llm_response(response.choices[0].message.content)
            
            return jsonify({
                "success": True,
                "suggestions": suggestions
            })
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            # Fallback suggestions based on role
            if role == 'worker':
                suggestions = [
                    "What benefits does this position offer?",
                    "Is there flexibility in the work schedule?",
                    "What growth opportunities are available?",
                    "Can you describe the team I'd be working with?"
                ]
            else:
                suggestions = [
                    "What relevant experience do you have for this role?",
                    "When would you be able to start?",
                    "What interests you most about this position?",
                    "Tell me about your biggest professional achievement"
                ]
            
            return jsonify({
                "success": True,
                "suggestions": suggestions
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 