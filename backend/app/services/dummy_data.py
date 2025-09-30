import random
import datetime as dt
from collections import Counter, defaultdict
from typing import List, Dict


STATES = ["MH", "MP", "OD", "TR"]
STATUSES = ["pending", "approved", "rejected"]
LAND_TYPES = ["degraded_forest", "community_forest", "agroforestry", "protected_zone"]


def seed_random(seed: int = 12508):
    random.seed(seed)


def generate_claim(idx: int) -> dict:
    state = random.choice(STATES)
    status = random.choices(STATUSES, weights=[0.45, 0.4, 0.15], k=1)[0]
    area = round(random.uniform(0.2, 12.0), 2)
    created = dt.date.today() - dt.timedelta(days=random.randint(0, 365))
    docs_complete = random.random() > 0.25
    is_duplicate = random.random() < 0.1
    critical_zone = random.random() < 0.12
    community_support = random.random() > 0.5
    land_type = random.choice(LAND_TYPES)
    return {
        "claim_id": f"CLM-{2000+idx}",
        "claimant": random.choice(["Asha","Ravi","Sita","Aman","Pooja","Rahul","Meera","Dev"]),
        "state": state,
        "status": status,
        "area_ha": area,
        "created": created.isoformat(),
        "docs_complete": docs_complete,
        "is_duplicate": is_duplicate,
        "is_in_critical_wildlife_zone": critical_zone,
        "community_support": community_support,
        "land_type": land_type,
    }


def generate_claims(n: int = 200) -> List[Dict]:
    seed_random()
    return [generate_claim(i) for i in range(n)]


def aggregates(claims: List[Dict]) -> Dict:
    total = len(claims)
    by_status = Counter(c["status"] for c in claims)
    by_state = Counter(c["state"] for c in claims)
    # time series by month
    by_month = defaultdict(int)
    for c in claims:
        y, m, _ = c["created"].split("-")
        by_month[f"{y}-{m}"] += 1
    # area distribution buckets
    buckets = {"0-2":0, "2-5":0, "5-10":0, "10+":0}
    for c in claims:
        a = c["area_ha"]
        if a <= 2: buckets["0-2"] += 1
        elif a <= 5: buckets["2-5"] += 1
        elif a <= 10: buckets["5-10"] += 1
        else: buckets["10+"] += 1
    return {
        "total": total,
        "by_status": dict(by_status),
        "by_state": dict(by_state),
        "by_month": dict(sorted(by_month.items())),
        "area_buckets": buckets,
    }


def land_use_insights(claims: List[Dict]) -> List[Dict]:
    # Basic heuristic recommendations per land_type and context
    recs = []
    for lt in LAND_TYPES:
        subset = [c for c in claims if c["land_type"] == lt]
        if not subset:
            continue
        avg_area = round(sum(c["area_ha"] for c in subset)/len(subset), 2)
        if lt == "degraded_forest":
            suggestion = "Afforestation and community forestry with native species"
        elif lt == "community_forest":
            suggestion = "Sustainable community-managed forestry and NTFP livelihood support"
        elif lt == "agroforestry":
            suggestion = "Agroforestry with mixed cropping and soil conservation"
        else:
            suggestion = "Conservation-first usage with minimal disturbance"
        recs.append({
            "land_type": lt,
            "claims": len(subset),
            "avg_area_ha": avg_area,
            "suggestion": suggestion,
        })
    return recs


