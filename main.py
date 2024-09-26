from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import pandas as pd
from dotenv import load_dotenv
import json
import re

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

# Global variable to store the dataset metadata and sample rows after upload
dataset_metadata = {}
sample_rows = []

# Define request and response models
class QueryRequest(BaseModel):
    prompt: str

# Function to generate the prompt for Vega-Lite, including sample rows
def generate_vega_prompt(data_info, sample_data, user_prompt):
    vega_prompt = f"""
You are an expert in data visualization. The user has provided the following query: '{user_prompt}'.

You have access to a dataset with the following columns and associated information:
{json.dumps(data_info, indent=2)}
 Here are dataset datapoints:
{json.dumps(sample_data, indent=2)}

If the user's request relates to creating a data visualization (pay close attention to words refering to columns of the dataset), generate a JSON response that contains:
1. "description": A concise explanation of the chart that you've created.
2. "specification": A full Vega-Lite specification, including:
   - "$schema": The URL for the Vega-Lite schema.
   - "data": A JSON object that includes the sample data points under the "values" key.
   - "mark": The type of visualization to be generated (e.g., "bar", "line", "point").
   - "encoding": Details on how the data fields are mapped to the axes and other visual elements (x-axis, y-axis, color, etc.).

If the user's request is unrelated to data visualization or analysis, provide the following response:
{{
  "description": "It seems that your request is unrelated to data visualization. It does not involve any analysis or visualization task."
}}

Here is an example of the Vega-Lite specification format:
{{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {{
    "values": [
      {{"category": "A", "group": "x", "value": 0.1}},
      {{"category": "A", "group": "y", "value": 0.6}},
      {{"category": "A", "group": "z", "value": 0.9}},
      {{"category": "B", "group": "x", "value": 0.7}},
      {{"category": "B", "group": "y", "value": 0.2}},
      {{"category": "B", "group": "z", "value": 1.1}},
      {{"category": "C", "group": "x", "value": 0.6}},
      {{"category": "C", "group": "y", "value": 0.1}},
      {{"category": "C", "group": "z", "value": 0.2}}
    ]
  }},
  "mark": "bar",
  "encoding": {{
    "x": {{"field": "category"}},
    "y": {{"field": "value", "type": "quantitative"}},
    "xOffset": {{"field": "group"}},
    "color": {{"field": "group"}}
  }}
}}
"""

    return vega_prompt

# Endpoint to handle CSV file upload and extract metadata and sample rows
@app.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):
    try:
        # Load the CSV file into a pandas DataFrame
        df = pd.read_csv(file.file)

        # Extract column names and data types
        data_info = {
            "columns": df.columns.tolist(),
            "types": [str(df[col].dtype) for col in df.columns]
        }

        # Get 15 sample rows
        sample_data = df.sample(n=15, random_state=1).to_dict(orient='records')

        # Store the dataset metadata and the sample rows in global variables
        global dataset_metadata, sample_rows
        dataset_metadata = data_info
        sample_rows = sample_data  # Store the sample rows for use in the query

        return {
            "message": "Data uploaded successfully.",
            "data_info": data_info,
            "sample_rows": sample_data  # Include the 15 sample rows in the response
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail="Error processing file: " + str(e))

@app.post("/query")
async def query_openai(request: QueryRequest):
    try:
        # Check if dataset metadata and sample rows have been uploaded
        global dataset_metadata, sample_rows
        if not dataset_metadata or not sample_rows:
            raise HTTPException(status_code=400, detail="No dataset uploaded yet. Please upload a dataset first.")

        # Generate the prompt based on the dataset information, sample rows, and user input
        prompt = generate_vega_prompt(dataset_metadata, sample_rows, request.prompt)
        print(prompt)

        # Call the OpenAI API with the generated prompt
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that generates Vega-Lite specifications.",
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="gpt-3.5-turbo",
        )

        # Get the response content from OpenAI
        response_content = chat_completion.choices[0].message.content

        # Return the raw response content directly
        result = json.loads(response_content)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Root endpoint
@app.get("/")
async def read_root():
    return FileResponse('static/index.html')

# Mount the static directory
app.mount("/static", StaticFiles(directory="static"), name="static")
