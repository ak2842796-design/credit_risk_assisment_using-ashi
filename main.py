from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
ml_model = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_model["model"] = joblib.load(BASE_DIR / "model" / "credit_risk_model.pkl")
    ml_model["best_threshold"] = joblib.load(BASE_DIR / "model" / "best_threshold.pkl")
    yield
    ml_model.clear()


app = FastAPI(title="Credit Risk API", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


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
    cb_person_default_on_file: str
    cb_person_cred_hist_length: int


@app.get("/health")
def health():
    return {"message": "Credit Risk Prediction API is running!"}


@app.post("/predict")
def predict(data: LoanApplication):
    input_df = pd.DataFrame([data.model_dump()])
    probability = float(ml_model["model"].predict_proba(input_df)[:, 1][0])
    threshold = float(ml_model["best_threshold"])
    prediction = int(probability >= threshold)
    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": threshold,
        "Result": "high risk" if prediction == 1 else "low risk",
    }


# Sabse neeche rakhein, taaki API routes pehle match hon
app.mount("/", StaticFiles(directory=BASE_DIR / "static", html=True), name="static")
