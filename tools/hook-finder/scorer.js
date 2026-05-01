// Scoring and classification logic for hook page candidates.
// Scores are capped at their maximums, then summed.
// Classification rules are conservative: low source confidence overrides
// an otherwise high total score to prevent publishing unverified claims.

const SCORE_CAPS = {
  b2c_fit_score: 25,
  consumer_loss_score: 25,
  search_demand_score: 20,
  source_confidence_score: 20,
  commercial_fit_score: 10,
};

// Below this confidence level the candidate cannot reach needs_review,
// regardless of how well it scores on other dimensions.
const LOW_CONFIDENCE_THRESHOLD = 10;

export function scoreCandidate(candidate) {
  const b2c = Math.min(candidate.b2c_fit_score ?? 0, SCORE_CAPS.b2c_fit_score);
  const loss = Math.min(candidate.consumer_loss_score ?? 0, SCORE_CAPS.consumer_loss_score);
  const demand = Math.min(candidate.search_demand_score ?? 0, SCORE_CAPS.search_demand_score);
  const confidence = Math.min(candidate.source_confidence_score ?? 0, SCORE_CAPS.source_confidence_score);
  const commercial = Math.min(candidate.commercial_fit_score ?? 0, SCORE_CAPS.commercial_fit_score);

  const total_score = b2c + loss + demand + confidence + commercial;
  const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

  let status;
  if (total_score >= 80 && !lowConfidence) {
    status = "needs_review";
  } else if (total_score >= 60 || (total_score >= 80 && lowConfidence)) {
    // High-scoring but unverified candidates sit in monitoring, not needs_review.
    status = "monitoring";
  } else {
    status = "rejected";
  }

  let risk_level;
  if (lowConfidence) {
    risk_level = "high";
  } else if (confidence < 15) {
    risk_level = "medium";
  } else {
    risk_level = "low";
  }

  return {
    ...candidate,
    b2c_fit_score: b2c,
    consumer_loss_score: loss,
    search_demand_score: demand,
    source_confidence_score: confidence,
    commercial_fit_score: commercial,
    total_score,
    status,
    risk_level,
    _score_breakdown: { b2c, loss, demand, confidence, commercial },
  };
}

export function scoreCandidates(candidates) {
  return candidates.map(scoreCandidate).sort((a, b) => b.total_score - a.total_score);
}

export const SCORE_CAPS_EXPORT = SCORE_CAPS;
