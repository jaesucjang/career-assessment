// ═══ V3 채점 엔진 — 편차 가중 코사인 유사도 + 응답 분산 감지 ═══

function buildProfile(answers) {
  const profile = {};
  DIMENSIONS.forEach(d => profile[d] = 0);
  QUESTIONS.forEach((q, idx) => {
    const score = answers[idx] || 0;
    Object.entries(q.dims).forEach(([dim, weight]) => {
      profile[dim] += score * weight;
    });
  });
  return profile;
}

function profileToArray(profile) {
  return DIMENSIONS.map(d => profile[d] || 0);
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * 응답 자체의 분산 (1~5 점수의 퍼짐 정도)
 * 모두 같은 답이면 0, 다양하면 클수록 큼
 */
function answerVariance(answers) {
  const avg = answers.reduce((a, b) => a + b, 0) / answers.length;
  const variance = answers.reduce((s, v) => s + (v - avg) * (v - avg), 0) / answers.length;
  return Math.sqrt(variance); // 표준편차 반환
}

/**
 * 편차 프로파일: 프로파일에서 평균을 빼서 "어디가 상대적으로 높은지"만 남김
 */
function deviationVector(rawVec) {
  const avg = rawVec.reduce((a, b) => a + b, 0) / rawVec.length;
  return rawVec.map(v => v - avg);
}

/**
 * 학생 프로파일과 모든 계열 archetype 유사도 계산
 */
function matchArchetypes(answers) {
  const profile = buildProfile(answers);
  const studentRaw = profileToArray(profile);
  const studentDev = deviationVector(studentRaw);

  const results = [];
  Object.entries(ARCHETYPES).forEach(([majorName, archVec]) => {
    const archDev = deviationVector(archVec);
    const sim = cosineSimilarity(studentDev, archDev);
    results.push({
      name: majorName,
      similarity: sim,
      score: Math.round(Math.max(0, sim) * 100),
    });
  });

  results.sort((a, b) => b.similarity - a.similarity);
  return results;
}

/**
 * 상위 N개 계열 추천
 */
function getTopMajors(answers, count = 3) {
  const allScores = matchArchetypes(answers);
  const avgAnswer = answers.reduce((a, b) => a + b, 0) / answers.length;
  const stdDev = answerVariance(answers);

  // ─── Case 1: 응답 분산이 매우 낮음 (대부분 같은 점수를 선택) ───
  if (stdDev < 0.6) {
    const etcMajor = MAJORS.find(m => m.id === 'etc');
    const freeMajor = MAJORS.find(m => m.id === 'free');

    if (avgAnswer <= 2.5) {
      // 대부분 "아니다" → 기타 추천
      return {
        results: [
          { ...etcMajor, score: 0, similarity: 0 },
          { ...freeMajor, score: 0, similarity: 0 },
          { ...(MAJORS.find(m => m.name === allScores[0]?.name) || freeMajor), score: allScores[0]?.score || 0, similarity: allScores[0]?.similarity || 0 },
        ],
        allScores,
        specialCase: 'no_interest',
      };
    } else {
      // 대부분 "그렇다" 이상 → 자율전공 추천
      return {
        results: [
          { ...freeMajor, score: allScores[0]?.score || 50, similarity: 0.5 },
          { ...(MAJORS.find(m => m.name === allScores[0]?.name) || etcMajor), score: allScores[0]?.score || 0, similarity: allScores[0]?.similarity || 0 },
          { ...(MAJORS.find(m => m.name === allScores[1]?.name) || etcMajor), score: allScores[1]?.score || 0, similarity: allScores[1]?.similarity || 0 },
        ],
        allScores,
        specialCase: 'even_interest',
      };
    }
  }

  // ─── Case 2: 1위와 평균 차이가 작으면 → 자율전공 ───
  const top = allScores[0];
  const avg = allScores.reduce((s, r) => s + r.similarity, 0) / allScores.length;
  const spread = top.similarity - avg;

  if (spread < 0.05 && top.similarity > 0) {
    const freeMajor = MAJORS.find(m => m.id === 'free');
    const topResults = allScores.slice(0, count - 1).map(r => {
      const major = MAJORS.find(m => m.name === r.name);
      return { ...major, score: r.score, similarity: r.similarity };
    });
    return {
      results: [{ ...freeMajor, score: top.score, similarity: top.similarity }, ...topResults],
      allScores,
      specialCase: 'even_spread',
    };
  }

  // ─── Case 3: 정상 → 상위 N개 ───
  const results = allScores.slice(0, count).map(r => {
    const major = MAJORS.find(m => m.name === r.name);
    return { ...major, score: r.score, similarity: r.similarity };
  });

  return { results, allScores };
}

/**
 * 성격 프로파일 문장 생성
 */
function buildPersonalityText(answers) {
  const profile = buildProfile(answers);
  const stdDev = answerVariance(answers);
  const avgAnswer = answers.reduce((a, b) => a + b, 0) / answers.length;

  // 분산 낮으면 특수 메시지
  if (stdDev < 0.6) {
    if (avgAnswer <= 2.5) {
      return {
        summary: '아직 탐색하는 중이에요!',
        detail: '괜찮아요! 다양한 경험을 쌓으면서 나의 흥미를 찾아가는 것도 멋진 과정이에요.',
        topDims: [],
      };
    } else {
      return {
        summary: '모든 분야에 고르게 관심이 있어요!',
        detail: '여러 분야를 넓게 탐색할 수 있는 자율전공이 잘 어울려요.',
        topDims: [],
      };
    }
  }

  const groups = {
    thinking: ['T1', 'T2'],
    interest: ['I1', 'I2', 'I3', 'I4', 'I5'],
    solving: ['P1', 'P2', 'P3', 'P4'],
    value: ['V1', 'V2', 'V3', 'V4', 'V5'],
    env: ['E1', 'E2', 'E3', 'E4'],
  };

  const topOf = (keys) => {
    let best = keys[0];
    keys.forEach(k => { if ((profile[k] || 0) > (profile[best] || 0)) best = k; });
    return best;
  };

  const t = topOf(groups.thinking);
  const i = topOf(groups.interest);
  const p = topOf(groups.solving);
  const v = topOf(groups.value);
  const e = topOf(groups.env);

  return {
    summary: `${DIM_LABELS[v]} ${DIM_LABELS[p]}!`,
    detail: `${DIM_LABELS[i]} 너는, ${DIM_LABELS[t]} 사고를 잘 하고 ${DIM_LABELS[e]} 가장 빛나는 사람이야!`,
    topDims: [
      { code: v, label: DIM_LABELS[v], score: profile[v] },
      { code: p, label: DIM_LABELS[p], score: profile[p] },
      { code: i, label: DIM_LABELS[i], score: profile[i] },
      { code: t, label: DIM_LABELS[t], score: profile[t] },
      { code: e, label: DIM_LABELS[e], score: profile[e] },
    ],
  };
}

/**
 * 교차 검증
 */
const CROSS_CHECKS = [
  { major: '의약학계열', qA: 18, qB: 7, msg: '사람을 돕고 싶은 마음은 있지만, 과학 탐구와의 연결은 더 고민해봐도 좋아요' },
  { major: '보건간호학계열', qA: 18, qB: 19, msg: '돌봄에 대한 관심은 있지만, 소통 방식에 대해 더 탐색해보세요' },
  { major: '교육학계열', qA: 20, qB: 10, msg: '가르치는 건 좋아하지만, 다양한 소통 상황도 함께 생각해보세요' },
  { major: '국방계열', qA: 12, qB: 17, msg: '규율은 좋아하지만 체력 활동은 아직 확신이 없을 수 있어요' },
  { major: '정보컴퓨터공학계열', qA: 6, qB: 15, msg: '고치는 건 좋아하지만, 처음부터 만드는 것도 즐길 수 있는지 생각해보세요' },
  { major: '상경계열', qA: 1, qB: 23, msg: '경제 현상에 관심은 있지만, 숫자 분석과의 궁합도 체크해보세요' },
  { major: '물리천문학계열', qA: 2, qB: 29, msg: '우주에 대한 호기심은 있지만, 수학적 분석과의 연결을 확인해보세요' },
  { major: '인문과학계열', qA: 0, qB: 24, msg: '문화적 관심은 있지만, 혼자 깊이 파고드는 것도 즐기는지 생각해보세요' },
];

function getCrossCheckMessages(answers, topMajorNames) {
  const messages = [];
  CROSS_CHECKS.forEach(cc => {
    if (topMajorNames.includes(cc.major)) {
      const scoreA = answers[cc.qA] || 0;
      const scoreB = answers[cc.qB] || 0;
      if (Math.abs(scoreA - scoreB) >= 3) {
        messages.push({ major: cc.major, msg: cc.msg });
      }
    }
  });
  return messages;
}
