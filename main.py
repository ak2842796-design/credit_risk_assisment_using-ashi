from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ml_model = {}
  

@asynccontextmanager
async def lifespan(app: FastAPI):          # <-- app parameter add kiya
    ml_model['model'] = joblib.load('model/credit_risk_model.pkl')
    ml_model['best_threshold'] = joblib.load('model/best_threshold.pkl')
    yield
    ml_model.clear()

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoanApplication(BaseModel):
    person_age: int
    person_income: float
    person_home_ownership: str
    person_emp_length: float
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: str       # cd_ -> cb_
    cb_person_cred_hist_length: int      # cd_ -> cb_

@app.get("/")
def read_root():
    return {"message": "Credit Risk Prediction API is running!"}

@app.post("/predict")
def predict(data: LoanApplication):
    input_df = pd.DataFrame([data.model_dump()])   # .dict() deprecated hai
    probability = float(ml_model['model'].predict_proba(input_df)[:, 1][0])
    threshold = float(ml_model['best_threshold'])
    prediction = int(probability >= threshold)
    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": threshold,
        "Result": "high risk" if prediction == 1 else "low risk"
    }
app.mount("/static", StaticFiles(directory="static",html=True), name="static")  # Static files serve karne ke liye