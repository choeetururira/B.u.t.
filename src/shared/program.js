/*
 * B.U.T. TOKYO 2026 — 프로그램 설정 (일정 · 미션 · 성찰 질문 · 주제 · 디자인 토큰)
 * 이 파일 하나만 고치면 학생 웹앱, 관리자 페이지, 모든 결과물에 반영됩니다.
 * (Apps Script · 브라우저 · Node 공용 파일: ES2019 문법만 사용)
 */
var BUT_Program = (function () {
  var program = {
    code: 'BUT-TOKYO-2026',
    brand: 'B.U.T. TOKYO 2026',
    brandFull: 'Beyond Universal Togetherness',
    title: '벗과 함께 도쿄를 기록하다',
    subtitle: '2026학년도 한일 고등학생 국제교류 국외현장체험학습',
    schoolName: '○○고등학교', // ← 학교명으로 바꾸세요
    period: '2026. 12. 7.(월) – 12. 10.(목) · 3박 4일',
    participants: 20,
    timeZone: 'Asia/Tokyo',
    hotel: '신주쿠 워싱턴호텔',

    // 제출 규칙
    rules: {
      minPhotos: 1,
      maxPhotos: 3,
      maxOriginalBytes: 20 * 1024 * 1024, // 원본 1장 최대 20MB
      maxDisplayBytes: 4 * 1024 * 1024,
      displayMaxEdge: 2000, // 출력용 사본 긴 변 픽셀
      reflectionMin: 30,
      reflectionMax: 1000,
      essayMin: 100,
      essayMax: 3000,
      oneLineMax: 30,
      captionMax: 40,
      studentIdPattern: '^[0-9A-Za-z-]{1,12}$',
      pinPattern: '^[0-9]{4,6}$',
      loginMaxFails: 5,
      loginLockMinutes: 60, // 5회 실패 시 60분 잠금 (4자리 PIN 무차별 대입 방지)
      studentTokenHours: 24 * 7,
      adminTokenHours: 8
    },

    days: [
      {
        day: 1,
        date: '2026-12-07',
        dateLabel: '12.07',
        weekday: '월',
        weekdayEn: 'MON',
        theme: '도쿄의 첫인상',
        themeSub: '도시와 청소년 문화',
        places: ['도쿄타워', '시부야', '하라주쿠'],
        missions: [
          '한국의 도시와 다른 풍경 발견하기',
          '일본의 10대 문화를 보여주는 장면 기록하기'
        ],
        question: '일본에 오기 전의 이미지와 직접 경험한 일본은 어떻게 달랐나요?',
        sampleOneLine: '낯선 도시에서 발견한 익숙함',
        color: '#C2432F',
        schedule: [
          ['08:05', '인천국제공항 출발 (진에어 LJ235)'],
          ['10:45', '나리타국제공항 도착 및 입국수속'],
          ['12:30', '중식'],
          ['13:30', '도쿄 시내로 이동'],
          ['15:00', '도쿄타워 전파탑'],
          ['17:00', '시부야·하라주쿠 10대 문화거리 탐방'],
          ['18:30', '석식'],
          ['20:00', '숙소 도착 및 휴식']
        ]
      },
      {
        day: 2,
        date: '2026-12-08',
        dateLabel: '12.08',
        weekday: '화',
        weekdayEn: 'TUE',
        theme: '즐거움 속에서 발견하는 일본',
        themeSub: '대중교통과 공간 디자인',
        places: ['대중교통', '도쿄 디즈니랜드'],
        missions: [
          '일본 대중교통의 안내 및 배려 문화 발견하기',
          '방문객을 위한 서비스나 공간 디자인 관찰하기'
        ],
        question: '오늘 경험한 공간에서 우리 학교나 지역사회에도 적용하고 싶은 아이디어는 무엇인가요?',
        sampleOneLine: '작은 배려가 만드는 즐거움',
        color: '#2F5D8C',
        schedule: [
          ['06:00', '기상 및 호텔 조식'],
          ['08:00', '지하철로 이동 (신주쿠역 – 도쿄역 – 마이하마역)'],
          ['09:00', '도쿄 디즈니랜드 탐방 (전일 자유이용권)'],
          ['20:00', '숙소 도착 및 휴식']
        ]
      },
      {
        day: 3,
        date: '2026-12-09',
        dateLabel: '12.09',
        weekday: '수',
        weekdayEn: 'WED',
        theme: '국경을 넘어 벗이 되다',
        themeSub: '자매학교 교류',
        places: ['도쿄도립 남평고등학교', '도쿄도청'],
        missions: [
          '일본 친구와 나의 공통점과 차이점 발견하기',
          '일본 친구와 소통하며 기억에 남은 순간 기록하기'
        ],
        question: '일본 친구들과 직접 교류하면서 새롭게 알게 된 점과 앞으로 이어가고 싶은 교류는 무엇인가요?',
        sampleOneLine: '언어가 달라도 친구가 될 수 있다',
        color: '#4F7A5A',
        schedule: [
          ['06:00', '기상 및 호텔 조식'],
          ['08:00', '자매학교로 이동 (전용버스)'],
          ['09:00', '자매학교 공식 방문 · 도쿄도립 남평고등학교'],
          ['17:00', '도쿄도청 전망대 — 시내 전경 및 야경 감상'],
          ['20:00', '숙소 도착 및 휴식']
        ]
      },
      {
        day: 4,
        date: '2026-12-10',
        dateLabel: '12.10',
        weekday: '목',
        weekdayEn: 'THU',
        theme: '전통과 미래, 그리고 나의 성장',
        themeSub: '대학 탐방과 전통문화',
        places: ['도쿄대학교', '아사쿠사 센소지', '나카미세 도오리'],
        missions: [
          '대학생과의 질의응답에서 인상 깊었던 내용 기록하기',
          '일본의 전통문화가 현대에 이어지는 모습 발견하기'
        ],
        question: '이번 국외현장체험학습은 나의 진로, 가치관, 다른 문화에 대한 태도에 어떤 변화를 가져왔나요?',
        sampleOneLine: '더 넓은 세상을 꿈꾸게 된 날',
        color: '#8A5A3C',
        schedule: [
          ['06:00', '기상 및 호텔 조식'],
          ['10:00', '도쿄대학 방문 — 한인 재학생과 캠퍼스 투어 및 질의응답'],
          ['12:00', '중식'],
          ['13:00', '아사쿠사 센소지 & 나카미세 도오리'],
          ['15:00', '나리타국제공항으로 이동 및 탑승수속'],
          ['18:50', '나리타국제공항 출발 (진에어 LJ264)'],
          ['21:40', '인천국제공항 도착']
        ]
      }
    ],

    // 주제별 포스터: 교사가 태그를 지정하지 않으면 키워드로 자동 분류
    topics: [
      {
        key: 'friend',
        title: '벗',
        en: 'FRIENDSHIP',
        desc: '말이 서툴러도 마음은 통했다 — 국경을 넘어 친구가 된 순간들',
        color: '#4F7A5A',
        keywords: ['친구', '벗', '교류', '대화', '소통', '함께', '우정', '자매학교', '번역', '인사', '선물', '웃']
      },
      {
        key: 'discover',
        title: '발견',
        en: 'DISCOVERY',
        desc: '낯선 도시에서 처음 마주한 풍경과 문화',
        color: '#C2432F',
        keywords: ['발견', '처음', '새롭', '신기', '다르', '차이', '풍경', '거리', '문화', '시부야', '하라주쿠', '도쿄타워', '야경']
      },
      {
        key: 'care',
        title: '배려',
        en: 'CONSIDERATION',
        desc: '작은 안내판과 친절에서 배운 함께 사는 법',
        color: '#2F5D8C',
        keywords: ['배려', '질서', '친절', '안내', '서비스', '디자인', '깨끗', '조용', '줄', '표지', '대중교통', '지하철']
      },
      {
        key: 'grow',
        title: '성장',
        en: 'GROWTH',
        desc: '전통과 미래 사이에서 그려 본 나의 다음 걸음',
        color: '#8A5A3C',
        keywords: ['꿈', '진로', '성장', '변화', '미래', '목표', '대학', '전통', '공부', '도전', '나의', '생각이 바뀌']
      }
    ],

    design: {
      paper: '#F5F0E6',
      paperDeep: '#EBE3D3',
      card: '#FBF8F2',
      ink: '#23303F',
      inkSoft: '#5B6573',
      line: '#CFCABC',
      accent: '#C2432F',
      indigo: '#2F4A6D',
      sage: '#A9AE9A',
      gold: '#B8925A',
      fonts: {
        title: 'Gowun Dodum',
        body: 'Gowun Batang',
        label: 'Gowun Dodum'
      }
    }
  };

  function getDay(n) {
    for (var i = 0; i < program.days.length; i++) if (program.days[i].day === Number(n)) return program.days[i];
    return null;
  }
  function pad2(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }
  function dayLabel(n) {
    return 'DAY ' + pad2(n);
  }

  return { program: program, getDay: getDay, pad2: pad2, dayLabel: dayLabel };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BUT_Program;
