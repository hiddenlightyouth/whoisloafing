import { getLang } from './i18n'

/**
 * 탐색의 동아리 탭에서 동아리를 고르면 "어떤 단체인가요?" 아래에 보여주는 설명이에요.
 * 이름은 서버의 ExploreClubs와 똑같이 적어요. 서버에 동아리를 더하면 여기에도 설명을 더하고, 설명이 없는 동아리는 질문 줄을 띄우지 않아요.
 */
const CLUBS: Record<string, { ko: string; en: string }> = {
  DDD: {
    ko: '개발자와 디자이너가 모여 함께 사이드 프로젝트를 만드는 IT 커뮤니티예요.',
    en: 'A Korean IT community where developers and designers team up to build side projects.',
  },
  넥스터즈: {
    ko: '개발자와 디자이너가 팀을 꾸려 몇 달 동안 서비스를 기획하고 출시하는 IT 연합 동아리예요.',
    en: 'A Korean IT club where developers and designers form teams and ship a product over a few months.',
  },
  YAPP: {
    ko: '기획자, 디자이너, 개발자가 모여 실제로 쓰이는 서비스를 만드는 대학생 IT 연합 동아리예요.',
    en: 'A Korean inter-university IT club where planners, designers and developers build real services together.',
  },
  'Mash-Up': {
    ko: '개발자와 디자이너가 함께 공부하고 서비스를 만드는 IT 연합 동아리예요.',
    en: 'A Korean IT club where developers and designers study together and build products.',
  },
  AUSG: {
    ko: 'AWS를 함께 공부하는 대학생 모임이에요. 클라우드 기술을 공부하고 발표와 행사를 열어요.',
    en: 'A Korean student group that studies AWS and cloud technology together and runs talks and events.',
  },
  DND: {
    ko: '개발자와 디자이너가 팀을 이뤄 사이드 프로젝트를 만드는 IT 비영리 단체예요.',
    en: 'A Korean nonprofit where developers and designers team up to build side projects.',
  },
  SOPT: {
    ko: '대학생 연합 IT 창업 동아리예요. 기획, 디자인, 개발 파트가 함께 앱과 웹 서비스를 만들어요.',
    en: 'A Korean inter-university startup club where planning, design and engineering parts build apps and web services together.',
  },
  멋쟁이사자처럼: {
    ko: '대학마다 지부가 있는 대학생 IT 동아리예요. 프로그래밍을 처음 배우는 학생도 함께 웹 서비스를 만들어 봐요.',
    en: 'A Korean university IT club with chapters at many schools, where even beginners learn to code and build web services.',
  },
  'GDG on Campus': {
    ko: '구글이 지원하는 대학생 개발자 커뮤니티예요. 학교마다 지부가 있고, 함께 기술을 공부하며 프로젝트를 만들어요.',
    en: 'Google-supported student developer communities with chapters at Korean universities, studying tech and building projects together.',
  },
  디프만: {
    ko: '디자이너와 프로그래머가 만나 함께 서비스를 만드는 IT 연합 동아리예요.',
    en: 'Depromeet, a Korean IT club where designers and programmers meet to build products together.',
  },
  프로그라피: {
    ko: '개발자와 디자이너가 함께 서비스를 만들고 출시하는 IT 비영리 단체예요.',
    en: 'A Korean IT nonprofit where developers and designers build and launch services together.',
  },
  CEOS: {
    ko: '신촌 지역 대학생들이 모여 IT 창업을 준비하는 연합 동아리예요.',
    en: 'A startup club for university students around Sinchon in Seoul, preparing to launch IT ventures.',
  },
  CMC: {
    ko: '앱 서비스를 만들어 출시하고 운영까지 경험해 보는 IT 연합 동아리예요.',
    en: 'A Korean IT club where teams build, launch and run their own app services.',
  },
  UMC: {
    ko: '대학마다 지부가 있는 IT 연합 동아리예요. 기획, 디자인, 개발 파트가 함께 앱과 웹 서비스를 만들어요.',
    en: 'A Korean inter-university IT club with chapters at many schools, where planning, design and engineering parts build apps together.',
  },
  XREAL: {
    ko: '서울대학교 학생들이 가상 현실과 증강 현실 기술을 공부하고 프로젝트를 만드는 동아리예요.',
    en: 'A Seoul National University club that studies virtual and augmented reality and builds XR projects.',
  },
  'Cloud Club': {
    ko: '클라우드 기술을 함께 공부하고 프로젝트를 만드는 대학생 IT 연합 동아리예요.',
    en: 'A Korean student club that studies cloud technology and builds projects together.',
  },
  피로그래밍: {
    ko: '비전공자도 함께 웹 개발을 배우는 대학생 IT 연합 동아리예요. 짧은 기간 집중해서 공부하고 프로젝트를 만들어요.',
    en: 'Pirogramming, a Korean student club where even non-CS majors learn web development intensively and build projects.',
  },
  SIPE: {
    ko: '개발자들이 모여 함께 공부하고 프로젝트를 만드는 IT 커뮤니티예요.',
    en: 'A Korean developer community that studies together and builds projects.',
  },
  '9oormthonUNIV': {
    ko: '구름이 지원하는 대학생 IT 연합 동아리예요. 학교마다 지부가 있고, 해커톤과 프로젝트를 함께 해요.',
    en: 'A Korean university IT club supported by goorm, with chapters at many schools running hackathons and projects.',
  },
  BOAZ: {
    ko: '빅데이터를 공부하는 대학생 연합 동아리예요. 데이터 분석과 엔지니어링을 함께 배우고 프로젝트를 해요.',
    en: 'A Korean inter-university big data club that studies data analysis and engineering through projects.',
  },
  SUSC: {
    ko: '여러 대학의 학생들이 모여 소프트웨어 프로젝트를 함께하는 연합 동아리예요.',
    en: 'A Korean inter-university club where students work on software projects together.',
  },
  'Instruct.KR': {
    ko: '한국어 AI 모델과 데이터셋을 함께 만드는 오픈소스 AI 커뮤니티예요.',
    en: 'An open source AI community building Korean language models and datasets.',
  },
  KUSITMS: {
    ko: '한국대학생IT경영학회예요. IT와 경영에 관심 있는 대학생들이 모여 기획, 디자인, 개발을 함께 해요.',
    en: 'A Korean student society for IT and business, where members plan, design and build products together.',
  },
  Hack4Impact: {
    ko: '미국 대학생들이 비영리 단체에 필요한 소프트웨어를 무료로 만들어 주는 단체예요. 학교마다 지부가 있어요.',
    en: 'US university students building free software for nonprofits, with chapters at many schools.',
  },
  Blueprint: {
    ko: '비영리 단체를 위해 무료로 소프트웨어를 만드는 대학생 개발 동아리예요. UC 버클리에서 시작해서 여러 학교에 지부가 있어요.',
    en: 'A student club that builds free software for nonprofits. It started at UC Berkeley and has chapters at other schools.',
  },
  ACM: {
    ko: '세계에서 가장 큰 컴퓨터 학회예요. 대학마다 학생 지부가 있어서 함께 공부하고 프로젝트를 만들어요.',
    en: "The world's largest computing society. Its student chapters at universities study and build projects together.",
  },
  'Cornell DTI': {
    ko: '코넬대 학생들이 캠퍼스와 지역 사회에 쓰일 서비스를 만드는 프로젝트 팀이에요.',
    en: 'A Cornell student project team building products for the campus and local community.',
  },
  'Cornell AppDev': {
    ko: '코넬대 학생들이 학교 생활에 쓰이는 앱을 만들고 운영하는 프로젝트 팀이에요.',
    en: 'A Cornell student team that builds and runs apps used in campus life.',
  },
  'Penn Labs': {
    ko: '펜실베이니아대 학생들이 학교 사람들이 쓰는 앱과 웹 서비스를 만들고 운영하는 팀이에요.',
    en: 'A University of Pennsylvania student team that builds and runs apps and web services for the Penn community.',
  },
  ScottyLabs: {
    ko: '카네기멜런대 학생들이 학교 생활에 쓰이는 서비스를 만들고 해커톤을 여는 동아리예요.',
    en: 'A Carnegie Mellon student club that builds tools for campus life and runs hackathons.',
  },
  'Bits of Good': {
    ko: '조지아공대 학생들이 비영리 단체를 위해 소프트웨어를 만드는 동아리예요.',
    en: 'A Georgia Tech student club that builds software for nonprofits.',
  },
  Sandbox: {
    ko: '노스이스턴대 학생들이 교내 연구실을 위해 소프트웨어를 만드는 동아리예요.',
    en: "A Northeastern University student club that builds software for the university's researchers.",
  },
  'Purdue Hackers': {
    ko: '퍼듀대 학생들이 모여 만들고 싶은 것을 만들고, 해커톤과 모임을 여는 커뮤니티예요.',
    en: 'A Purdue student community that builds things for fun and runs hackathons and meetups.',
  },
  RCOS: {
    ko: '렌셀러공대의 오픈소스 모임이에요. 학생들이 학점을 받으며 오픈소스 소프트웨어를 만들어요.',
    en: "Rensselaer's open source center, where students earn credit building open source software.",
  },
  'DevSoc UNSW': {
    ko: '호주 뉴사우스웨일스대 학생들이 학생을 위한 서비스를 만드는 개발 동아리예요.',
    en: 'A UNSW Sydney student society that builds software for students.',
  },
  'Hack Club': {
    ko: '전 세계 10대 학생들이 코딩을 배우고 프로젝트를 만드는 비영리 단체예요. 학교마다 동아리가 있어요.',
    en: 'A global nonprofit network of teenage coders, with clubs at high schools around the world.',
  },
  'MLH Fellowship': {
    ko: 'Major League Hacking이 운영하는 원격 프로그램이에요. 참가자들이 팀을 이뤄 오픈소스 프로젝트에 기여해요.',
    en: 'A remote program run by Major League Hacking where fellows contribute to open source projects in teams.',
  },
  'Code for America': {
    ko: '기술로 미국 정부 서비스를 더 쉽게 쓰도록 만드는 비영리 단체예요.',
    en: 'A nonprofit that uses technology to make US government services easier to use.',
  },
  freeCodeCamp: {
    ko: '누구나 무료로 코딩을 배울 수 있게 강의와 과제를 만드는 비영리 단체예요.',
    en: 'A nonprofit that makes free coding lessons and exercises for anyone.',
  },
  'The Odin Project': {
    ko: '웹 개발을 처음부터 무료로 배울 수 있는 오픈소스 교육 과정이에요.',
    en: 'A free, open source curriculum for learning web development from scratch.',
  },
}

/** 받침으로 끝나는 영어 이름. 한국어로 읽었을 때 받침이 있어서 "은"을 붙여요. 한글 이름은 글자로 알아봐요. */
const EUN = new Set(['Mash-Up', 'Cloud Club', 'Hack Club', 'Bits of Good', 'MLH Fellowship', 'Instruct.KR', 'XREAL', 'KUSITMS', 'ACM'])

function topic(name: string): string {
  const last = name.charCodeAt(name.length - 1)
  const hangul = last >= 0xac00 && last <= 0xd7a3
  const batchim = hangul ? (last - 0xac00) % 28 !== 0 : EUN.has(name)
  return `${name}${batchim ? '은' : '는'}`
}

/** 동아리 설명. 지금 화면 언어로 돌려주고, 적어 둔 설명이 없으면 null이에요. */
export function clubInfo(name: string): { question: string; answer: string } | null {
  const info = CLUBS[name]
  if (!info) return null
  const lang = getLang()
  return lang === 'ko'
    ? { question: `${topic(name)} 어떤 단체인가요?`, answer: info.ko }
    : { question: `What is ${name}?`, answer: info.en }
}
