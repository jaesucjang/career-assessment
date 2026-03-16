// 채점 로직 & 계열 매핑
function calculateScores(answers) {
  // 계열별 점수 초기화
  const scores = {};
  MAJORS.forEach(m => {
    if (m.id !== 'free' && m.id !== 'etc') {
      scores[m.name] = 0;
    }
  });

  // 각 문항별 점수 합산
  QUESTIONS.forEach((q, idx) => {
    const score = answers[idx] || 0;
    // 주 매핑: 가중치 1.0
    q.primary.forEach(major => {
      if (scores[major] !== undefined) {
        scores[major] += score * 1.0;
      }
    });
    // 부 매핑: 가중치 0.5
    q.secondary.forEach(major => {
      if (scores[major] !== undefined) {
        scores[major] += score * 0.5;
      }
    });
  });

  return scores;
}

function getTopMajors(answers, count = 3) {
  const scores = calculateScores(answers);

  // 점수 내림차순 정렬
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  // 점수 편차 확인 (모든 영역 고르면 자율전공 추천)
  const maxScore = sorted[0][1];
  const minScore = sorted[sorted.length - 1][1];
  const avgScore = sorted.reduce((sum, s) => sum + s[1], 0) / sorted.length;

  // 최고점과 평균의 차이가 작으면 → 자율전공
  if (maxScore > 0 && (maxScore - avgScore) / avgScore < 0.15) {
    const freeMajor = MAJORS.find(m => m.id === 'free');
    const topResults = sorted.slice(0, count - 1).map(([name, score]) => {
      const major = MAJORS.find(m => m.name === name);
      return { ...major, score: Math.round(score) };
    });
    return [{ ...freeMajor, score: Math.round(maxScore) }, ...topResults];
  }

  // 상위 N개 반환
  return sorted.slice(0, count).map(([name, score]) => {
    const major = MAJORS.find(m => m.name === name);
    return { ...major, score: Math.round(score) };
  });
}

function getMaxPossibleScore() {
  // 모든 문항에 5점을 준 경우의 최대 점수 (대략적)
  const scores = {};
  MAJORS.forEach(m => {
    if (m.id !== 'free' && m.id !== 'etc') scores[m.name] = 0;
  });
  QUESTIONS.forEach(q => {
    q.primary.forEach(major => {
      if (scores[major] !== undefined) scores[major] += 5;
    });
    q.secondary.forEach(major => {
      if (scores[major] !== undefined) scores[major] += 2.5;
    });
  });
  return Math.max(...Object.values(scores));
}
