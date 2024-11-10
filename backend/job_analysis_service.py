from flask import Flask, request, jsonify
from openai import OpenAI
import os

app = Flask(__name__)
client = OpenAI(api_key=os.getenv('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'))

def generate_job_analysis(job_data, user_data):
    # Prepare the context for the LLM
    prompt = f"""
    Analyze this job match and create a natural, conversational description of why it's a good fit.
    
    Job Details:
    - Title: {job_data.get('jobTitle')}
    - Location: {job_data.get('distance')} miles away
    - Required Skills: {', '.join(job_data.get('requiredSkills', []))}
    - Salary Range: ${job_data.get('salaryRange', {}).get('min')}-${job_data.get('salaryRange', {}).get('max')}/hr
    - Weekly Hours: {job_data.get('weeklyHours')}
    
    User Profile:
    - Skills: {', '.join(user_data.get('skills', []))}
    - Experience: {user_data.get('experience', {}).get('totalYears')} years
    - Availability: {format_availability(user_data.get('availability', {}))}
    
    Create a natural response that covers:
    1. Location and commute analysis
    2. Schedule compatibility
    3. Skills and experience match
    4. Benefits and compensation highlights
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a job matching expert who provides friendly, conversational analysis of job fits."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"Error generating analysis: {e}")
        return "Unable to generate job analysis at this time."

def format_availability(availability):
    formatted = []
    for day, slots in availability.items():
        times = [f"{slot['startTime']}-{slot['endTime']}" for slot in slots]
        formatted.append(f"{day}: {', '.join(times)}")
    return '; '.join(formatted)

@app.route('/analyze-job-match', methods=['POST'])
def analyze_job_match():
    data = request.json
    job_data = data.get('job')
    user_data = data.get('user')
    
    analysis = generate_job_analysis(job_data, user_data)
    
    return jsonify({
        'analysis': analysis
    })

if __name__ == '__main__':
    app.run(port=5000) 