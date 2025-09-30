from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from functools import wraps
from datetime import timedelta
import json
import os
from app.services.ml_model import load_or_train_model, score_with_model
from app.services.dummy_data import generate_claims, aggregates, land_use_insights

api_bp = Blueprint("api", __name__)


@api_bp.post("/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    identifier = (body.get("identifier") or body.get("username") or body.get("email") or body.get("phone") or "").strip()
    password = (body.get("password") or "").strip()

    # Demo only: static users. Replace with DB/IdP in production.
    demo_users = [
        {"username": "admin", "email": "admin@example.com", "phone": "+911234567890", "password": "admin123", "role": "admin"},
        {"username": "officer", "email": "officer@example.com", "phone": "+919876543210", "password": "officer123", "role": "officer"},
    ]

    def match_user(u):
        return identifier.lower() in {
            u["username"].lower(),
            u["email"].lower(),
            u["phone"].lower(),
        }

    user = next((u for u in demo_users if match_user(u) and password == u["password"]), None)
    if not user:
        return jsonify({"error": "invalid_credentials"}), 401

    identity = {"username": user["username"], "role": user["role"]}
    access_token = create_access_token(identity=identity, expires_delta=timedelta(hours=2))
    refresh_token = create_refresh_token(identity=identity, expires_delta=timedelta(days=7))
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"username": user["username"], "email": user["email"], "phone": user["phone"], "role": user["role"]},
    })


@api_bp.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh_access():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity, expires_delta=timedelta(hours=2))
    return jsonify({"access_token": access_token})


def require_roles(*allowed_roles: str):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            role = None
            if isinstance(identity, dict):
                role = identity.get("role")
            if allowed_roles and role not in allowed_roles:
                return jsonify({"error": "forbidden", "role": role, "allowed": list(allowed_roles)}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


@api_bp.get("/map/layers")
@require_roles("officer", "admin")
def get_map_layers():
    layers = [
        {"id": "india", "type": "geojson", "name": "India Outline", "url": "/api/map/geojson/india"},
        {"id": "mh", "type": "geojson", "name": "Maharashtra", "url": "/api/map/geojson/mh"},
        {"id": "mp", "type": "geojson", "name": "Madhya Pradesh", "url": "/api/map/geojson/mp"},
        {"id": "od", "type": "geojson", "name": "Odisha", "url": "/api/map/geojson/od"},
        {"id": "tr", "type": "geojson", "name": "Tripura", "url": "/api/map/geojson/tr"},
        {"id": "fra_claims", "type": "geojson", "name": "FRA Claims (sample)", "url": "/api/map/geojson/fra_claims"},
    ]
    return jsonify({"layers": layers})


@api_bp.get("/decisions/recommendations")
@require_roles("officer", "admin")
def get_recommendations():
    params = request.args.to_dict()
    sample = {
        "input": params,
        "recommendations": [
            {
                "id": "rec-1",
                "title": "Prioritize claims with complete documents",
                "impact": "high",
            },
            {
                "id": "rec-2",
                "title": "Flag duplicates based on claimant + parcel",
                "impact": "medium",
            },
        ],
    }
    return jsonify(sample)


@api_bp.get("/ai/insights")
@require_roles("admin")
def ai_insights():
    insights = [
        {"metric": "avg_processing_time_days", "value": 42},
        {"metric": "duplicate_claim_rate", "value": 0.07},
        {"metric": "doc_completeness_score", "value": 0.86},
    ]
    return jsonify({"insights": insights})


@api_bp.get("/dashboard/summary")
@require_roles("officer", "admin")
def dashboard_summary():
    summary = {
        "total_claims": 12345,
        "approved": 6789,
        "rejected": 2345,
        "pending": 3211,
        "by_state": {
            "MH": 1200,
            "MP": 980,
            "OD": 760,
        },
    }
    return jsonify(summary)


def _read_geojson(filename: str):
    assets_dir = os.path.join(os.path.dirname(__file__), "..", "assets")
    path = os.path.abspath(os.path.join(assets_dir, filename))
    if not os.path.exists(path):
        return {"type": "FeatureCollection", "features": []}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@api_bp.get("/map/geojson/<layer_id>")
@require_roles("officer", "admin")
def get_geojson(layer_id: str):
    if layer_id == "india":
        return jsonify(_read_geojson("india.geojson"))
    if layer_id == "mh":
        return jsonify(_read_geojson("mh.geojson"))
    if layer_id == "mp":
        return jsonify(_read_geojson("mp.geojson"))
    if layer_id == "od":
        return jsonify(_read_geojson("od.geojson"))
    if layer_id == "tr":
        return jsonify(_read_geojson("tr.geojson"))
    if layer_id == "fra_claims":
        return jsonify(_read_geojson("fra_claims_sample.geojson"))
    return jsonify({"error": "unknown_layer"}), 404


# ===== Decision Support: AI Scoring (Dummy) =====

def _score_claim(claim: dict) -> dict:
    """Produce a dummy priority score and explanation for a claim."""
    base = 50.0
    explanation = []
    if claim.get("docs_complete"):
        base += 15
        explanation.append("+15 complete documents")
    else:
        base -= 10
        explanation.append("-10 missing documents")
    if claim.get("is_duplicate"):
        base -= 25
        explanation.append("-25 potential duplicate")
    area = float(claim.get("area_ha", 0) or 0)
    if area <= 2:
        base += 10
        explanation.append("+10 small area <=2ha")
    elif area >= 10:
        base -= 5
        explanation.append("-5 large area >=10ha")
    if claim.get("is_in_critical_wildlife_zone"):
        base -= 15
        explanation.append("-15 critical wildlife zone")
    if claim.get("community_support"):
        base += 10
        explanation.append("+10 community support")
    status = claim.get("status")
    if status == "approved":
        base -= 40
        explanation.append("-40 already approved")
    elif status == "rejected":
        base -= 30
        explanation.append("-30 already rejected")

    score = max(0, min(100, round(base)))
    priority = "high" if score >= 70 else ("medium" if score >= 40 else "low")
    return {
        "score": score,
        "priority": priority,
        "explanation": "; ".join(explanation),
    }


@api_bp.post("/dss/score")
@require_roles("officer", "admin")
def dss_score():
    body = request.get_json(silent=True) or {}
    result = _score_claim(body)
    return jsonify({"input": body, "result": result})


@api_bp.post("/dss/score-batch")
@require_roles("officer", "admin")
def dss_score_batch():
    body = request.get_json(silent=True) or {}
    claims = body.get("claims") or []
    out = []
    for c in claims:
        out.append({"id": c.get("claim_id"), "result": _score_claim(c), "input": c})
    return jsonify({"results": out, "count": len(out)})


# ===== ML-based Scoring =====
_MODEL = None
_CLAIMS = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = load_or_train_model()
    return _MODEL


def _get_claims():
    global _CLAIMS
    if _CLAIMS is None:
        _CLAIMS = generate_claims(250)
    return _CLAIMS


@api_bp.post("/dss/ml/score")
@require_roles("officer", "admin")
def dss_ml_score():
    model = _get_model()
    body = request.get_json(silent=True) or {}
    res = score_with_model(model, body)
    return jsonify({"input": body, "result": res})


@api_bp.post("/dss/ml/score-batch")
@require_roles("officer", "admin")
def dss_ml_score_batch():
    model = _get_model()
    body = request.get_json(silent=True) or {}
    claims = body.get("claims") or []
    out = []
    for c in claims:
        out.append({"id": c.get("claim_id"), "result": score_with_model(model, c), "input": c})
    return jsonify({"results": out, "count": len(out)})


# ===== Dummy data endpoints =====
@api_bp.get("/claims")
@require_roles("officer", "admin")
def list_claims():
    return jsonify({"claims": _get_claims()})


@api_bp.get("/dashboard/aggregates")
@require_roles("officer", "admin")
def dashboard_aggregates():
    return jsonify(aggregates(_get_claims()))


@api_bp.get("/ai/landuse-insights")
@require_roles("officer", "admin")
def ai_landuse():
    return jsonify({"land_use": land_use_insights(_get_claims())})


