/**
 * Physical AI News — 스코어링용 키워드 사전
 * scorer.ts에서 import하여 사용
 */

/** 제조 피지컬AI 직접 언급 (+30) */
export const PHYSICAL_AI_DIRECT = [
  "피지컬AI", "피지컬 AI", "physical AI", "Physical AI",
  "제조AI", "제조 AI", "매뉴팩처링AI",
  "embodied AI", "embodied intelligence",
];

/** (로봇 OR 자동화) AND 제조 동시 (+20) — 각 그룹을 따로 정의 */
export const ROBOT_AUTOMATION = [
  "로봇", "로보틱스", "robot", "robotics",
  "자동화", "automation", "automated",
  "협동로봇", "cobot", "AMR", "AGV",
  "매니퓰레이터", "manipulator",
  "휴머노이드", "humanoid",
];

/** K-휴머노이드 컨소시엄 (코스맥스 가입사) (+30) */
export const K_HUMANOID = [
  "K-휴머노이드", "K휴머노이드", "K-humanoid",
  "휴머노이드 얼라이언스", "humanoid alliance",
  "K-휴머노이드 얼라이언스",
];

/** KIRIA M.AX 시리즈 (서비스로봇/제조로봇 AX 실증) (+30) */
export const M_AX = [
  "M.AX", "m.ax",
  "S-M.AX", "s-m.ax",
  "M-AX", "m-ax",
  "서비스로봇 AX", "제조로봇 AX",
  "Manufacturing AX",
];

export const MANUFACTURING = [
  "제조", "생산", "공장", "팩토리", "factory",
  "manufacturing", "production", "생산라인",
  "제조업", "제조공정", "산업용",
];

/** T2/T3 기업 키워드 (+20) */
export const TIER_COMPANIES = [
  "코스맥스", "COSMAX", "한국콜마", "콜마",
  "아모레퍼시픽", "아모레", "LG생활건강",
  "CJ올리브영", "올리브영",
  "삼성전자", "LG전자", "현대", "SK",
  "네이버", "카카오",
];

/** 생산/품질/설비/물류/공장 키워드 (T2/T3 기업과 AND) */
export const PRODUCTION_QUALITY = [
  "생산", "품질", "설비", "물류", "공장",
  "스마트팩토리", "smart factory",
  "공정", "QC", "검사", "포장", "충전",
];

/** 정부 실증/보급/지원/국책과제 (+25) */
export const GOV_SUPPORT = [
  "실증", "보급", "지원사업", "국책과제", "R&D",
  "국가과제", "정부과제", "공모", "공고",
  "바우처", "사업공고", "시범사업",
  "규제샌드박스", "특화사업",
  "RFP", "제안요청",
];

/** 화장품 제조 키워드 (+15) */
export const COSMETICS_MANUFACTURING = [
  "화장품", "코스메틱", "cosmetic", "beauty",
  "ODM", "OEM", "뷰티", "스킨케어",
  "기초화장품", "색조", "선크림",
  "원료", "배합", "충전", "포장",
];

/** 경기도 지역 키워드 (+10) — 화성/판교(성남) 중심 */
export const GYEONGGI_REGION = [
  "경기도", "경기", "화성", "판교", "성남",
  "수원", "용인", "안산",
];

/** 비관련 지역 키워드 (-30) — 경기도/서울/전국이 아닌 지역 */
export const NON_RELEVANT_REGION = [
  "대구", "경북", "부산", "경남", "울산",
  "대전", "충남", "충북", "전남", "전북",
  "광주", "강원", "제주", "세종",
];

/** 소비자용 AI / 마케팅 (-20) */
export const CONSUMER_AI_MARKETING = [
  "마케팅AI", "마케팅 AI", "추천 알고리즘",
  "개인화", "챗봇 상담", "고객 상담",
  "광고", "소셜미디어", "인플루언서",
  "피부분석 앱", "가상 메이크업", "AR 메이크업",
];

/** 주가/공시/IR 단독 (-15) */
export const STOCK_IR = [
  "주가", "시가총액", "공시", "IR",
  "배당", "주식", "증시", "코스피", "코스닥",
  "52주", "목표가", "투자의견",
  "분기실적", "영업이익률",
];

/** 정치/정책 뉴스 — 피지컬AI를 언급하지만 실질적 제조 내용 아님 (-25) */
export const POLITICS_NOISE = [
  "대통령", "민주노총", "민노총", "국회",
  "예비후보", "군수", "공약", "선거",
  "노동계", "노동자", "일자리 소멸", "일자리 위협",
  "글로벌 모닝 브리핑",
];

/** Tier 판별용: T0 핵심 키워드 (제조 피지컬AI 직접 관련) */
export const T0_KEYWORDS = [
  ...PHYSICAL_AI_DIRECT,
  "제조 로봇", "공장 자동화 AI", "산업용 로봇 AI",
  "휴머노이드", "휴머노이드 로봇", "humanoid robot", "humanoid",
];

/** T1 키워드 (스마트팩토리/제조자동화 넓은 범위) */
export const T1_KEYWORDS = [
  "스마트팩토리", "스마트공장", "smart factory",
  "디지털트윈", "digital twin",
  "산업용 로봇", "협동로봇",
  "MES", "SCADA", "PLC",
  "제조 DX", "제조 디지털전환",
];
