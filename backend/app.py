from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv('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'))

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

if __name__ == '__main__':
    app.run(debug=True) 