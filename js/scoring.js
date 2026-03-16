// ═══ V2 채점 엔진 — 5차원 프로파일 + 코사인 유사도 매칭 ═══

/**
 * 응답 배열 → 학생의 20차원 프로파일 벡터 계산
 */
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

/**
 * 프로파일 객체 → 배열 변환
 */
function profileToArray(profile) {
  return DIMENSIONS.map(d => profile[d] || 0);
}

/**
 * 코사인 유사도 계산
 */
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
 * 학생 프로파일과 모든 계열 archetype의 유사도 계산
 * 반환: [{ name, similarity, score }, ...] 내림차순
 */
function matchArchetypes(answers) {
  const profile = buildProfile(answers);
  const studentVec = profileToArray(profile);

  const results = [];
  Object.entries(ARCHETYPES).forEach(([majorName, archVec]) => {
    const sim = cosineSimilarity(studentVec, archVec);
    results.push({
      name: majorName,
      similarity: sim,
      score: Math.round(sim * 100), // 0~100점 스케일
    });
  });

  results.sort((a, b) => b.similarity - a.similarity);
  return results;
}

/**
 * 상위 N개 계열 추천 (자율전공 자동 판정 포함)
 */
function getTopMajors(answers, count = 3) {
  const allScores = matchArchetypes(answers);

  // 1위와 2위 차이가 너무 작으면 → 자율전공 추천
  const top = allScores[0];
  const avg = allScores.reduce((s, r) => s + r.similarity, 0) / allScores.length;
  const spread = top.similarity - avg;

  if (spread < 0.03 && top.similarity > 0) {
    // 점수 편차가 거의 없음 → 자율전공
    const freeMajor = MAJORS.find(m => m.id === 'free');
    const topResults = allScores.slice(0, count - 1).map(r => {
      const major = MAJORS.find(m => m.name === r.name);
      return { ...major, score: r.score, similarity: r.similarity };
    });
    return {
      results: [{ ...freeMajor, score: top.score, similarity: top.similarity }, ...topResults],
      allScores,
    };
  }

  const results = allScores.slice(0, count).map(r => {
    const major = MAJORS.find(m => m.name === r.name);
    return { ...major, score: r.score, similarity: r.similarity };
  });

  return { results, allScores };
}

/**
 * 학생의 상위 차원 3개 추출 → 성격 프로파일 문장 생성
 */
function buildPersonalityText(answers) {
  const profile = buildProfile(answers);

  // 차원 그룹별로 상위 추출
  const groups = {
    thinking: ['T1','T2'],
    interest: ['I1','I2','I3','I4','I5'],
    solving:  ['P1','P2','P3','P4'],
    value:    ['V1','V2','V3','V4','V5'],
    env:      ['E1','E2','E3','E4'],
  };

  const topOf = (keys) => {
    let best = keys[0];
    keys.forEach(k => { if ((profile[k]||0) > (profile[best]||0)) best = k; });
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
 * 교차 검증: 같은 계열을 측정하는 문항 쌍의 일관성 체크
 */
const CROSS_CHECKS = [
  { major:'의약학계열', qA:18, qB:7, msg:'사람을 돕고 싶은 마음은 있지만, 과학 탐구와의 연결은 더 고민해봐도 좋아요' },
  { major:'보건간호학계열', qA:18, qB:19, msg:'돌봄에 대한 관심은 있지만, 소통 방식에 대해 더 탐색해보세요' },
  { major:'교육학계열', qA:20, qB:10, msg:'가르치는 건 좋아하지만, 다양한 소통 상황도 함께 생각해보세요' },
  { major:'국방계열', qA:12, qB:17, msg:'규율은 좋아하지만 체력 활동은 아직 확신이 없을 수 있어요' },
  { major:'정보컴퓨터공학계열', qA:6, qB:15, msg:'고치는 건 좋아하지만, 처음부터 만드는 것도 즐길 수 있는지 생각해보세요' },
  { major:'상경계열', qA:1, qB:23, msg:'경제 현상에 관심은 있지만, 숫자 분석과의 궁합도 체크해보세요' },
  { major:'물리천문학계열', qA:2, qB:29, msg:'우주에 대한 호기심은 있지만, 수학적 분석과의 연결을 확인해보세요' },
  { major:'인문과학계열', qA:0, qB:24, msg:'문화적 관심은 있지만, 혼자 깊이 파고드는 것도 즐기는지 생각해보세요' },
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
