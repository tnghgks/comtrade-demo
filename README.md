# EChart COMTRADE Viewer

ECharts + echarts-for-react 로 구현한 **COMTRADE 파형 뷰어** 데모 프로젝트입니다.  
실제 COMTRADE ASCII 파일(`.cfg` + `.dat`)을 파싱하여 전압·전류 파형을 인터랙티브 차트로 표시합니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속합니다.

---

## COMTRADE란?

**COMTRADE** (Common Format for Transient Data Exchange, IEC 60255-24)는 전력 계통에서 **사고(고장) 순간의 전압·전류 파형을 기록·교환하기 위한 국제 표준 파일 포맷**입니다.

낙뢰, 단락, 지락 등 사고가 발생하면 보호 계전기나 디지털 고장 기록장치(DFR)가 사고 전후의 파형을 캡처하여 COMTRADE 파일로 저장합니다. 이 파일을 분석해서 사고 원인과 보호 동작 적정성을 검토합니다.

### 파일 구조

COMTRADE는 항상 **2개 파일 한 쌍**으로 구성됩니다.

```
사고기록.cfg   ← 설정 파일: 채널 정보, 샘플레이트, 트리거 시각 등 메타데이터
사고기록.dat   ← 데이터 파일: 실제 측정값 (ASCII 또는 Binary)
```

**CFG 파일 핵심 구조:**

```
GTPPLOT creates from ieee13_pv_l1c1b1f1.pl4,999,1999   ← 국소명, 장치ID, 버전(1999)
24,24A, 0D                                              ← 전체 채널 수, 아날로그 24개, 디지털 0개
  1,SBUS A V-node,A, , V, 0.9389, 0.0, 0.0,...          ← 채널1: 이름, 상, 단위(V), 배율, 오프셋
  2,SBUS B V-node,B, , V, 0.9389, 0.0, 0.0,...
  ...
 50                                                     ← 계통 주파수 50Hz
1                                                       ← 샘플레이트 종류 수
     20000,  12001                                      ← 샘플레이트 20000 Sa/s, 총 12001샘플
06/10/2022,20:28:05.000000                              ← 기록 시작 시각
06/10/2022,20:28:05.000000                              ← 트리거(사고) 시각
ASCII                                                   ← 데이터 파일 형식
    1.000000                                            ← 타임스탬프 배율
```

**DAT 파일 구조 (ASCII):**

```
샘플번호, 타임스탬프(μs), 채널1값, 채널2값, ...
1, 0, 12483, -9871, 5234, ...
2, 50, 12501, -9845, 5219, ...
3, 100, 12518, -9812, 5201, ...
```

---

## 포함된 샘플 데이터

`src/samples/` 에 **IEEE 13-bus 배전 계통 + PV(태양광) 시뮬레이션** 데이터가 포함되어 있습니다.

ATP(Alternative Transients Program)로 시뮬레이션한 결과를 COMTRADE로 변환한 파일입니다.

### 파일명 규칙

```
ieee13_pv_l{부하}c{구성}b{버스}f{고장유형}.cfg / .dat
```

| 기호 | 의미 | 값 |
|------|------|----|
| `l1/l2/l3` | 부하 수준 | 경부하 / 중부하 / 중부하 |
| `c1/c2` | PV 연계 구성 | 구성 A / 구성 B |
| `b1/b2/b3` | 고장 발생 버스 | 버스 위치 1 / 2 / 3 |
| `f1/f2/f3` | 고장 유형 | A상 지락 / B상 지락 / 3상 단락 |

### 샘플 파일 사양

| 항목 | 값 |
|------|----|
| 아날로그 채널 수 | 24개 (전압 3, 전류 3, PV/저장장치 신호 18) |
| 샘플레이트 | 20,000 Sa/s |
| 기록 길이 | 12,001샘플 ≈ 600ms |
| 계통 주파수 | 50 Hz |

채널 구성:

- `SBUS A/B/C V-node` — 모선 3상 전압 (V)
- `SBUS A/B/C 22 I-branch` — 송전선 3상 전류 (A)
- `FAULTA/B/C I-branch` — 고장점 전류 (A)
- `TACS PVxxx V/I/W` — 태양광 인버터 전압·전류·전력 (A)
- `TACS STxxx V/I/W` — 저장장치(ESS) 전압·전류·전력 (A)

---

## 프로젝트 구조

```
src/
├── samples/                         실제 COMTRADE 샘플 파일들 (.cfg/.dat)
│   ├── ieee13_pv_l1c1b1f1.cfg
│   ├── ieee13_pv_l1c1b1f1.dat
│   └── ...  (총 54쌍)
├── utils/
│   ├── comtradeParser.ts            CFG/DAT 파싱 로직
│   └── comtradeMock.ts              타입 정의 + 목 데이터 생성기
└── components/
    └── ComtradeChart.tsx            ECharts 차트 컴포넌트
App.tsx                              진입점: 파일 로드 → 파싱 → 차트
```

### 데이터 흐름

```
.cfg 파일 ──┐
            ├─→ comtradeParser.ts ─→ ComtradeRecord ─→ ComtradeChart.tsx ─→ 화면
.dat 파일 ──┘       (파싱)               (공통 타입)       (ECharts 렌더링)
```

---

## 주요 파일 설명

### `comtradeParser.ts` — 실제 파서

CFG와 DAT 텍스트를 받아 `ComtradeRecord` 객체를 반환합니다.

```typescript
export function parseComtrade(cfgText: string, datText: string): ComtradeRecord
```

**파싱 단계:**

1. **CFG 파싱** — 채널 수, 각 채널의 `name / unit / multiplier / offset`, 샘플레이트, 트리거 시각을 읽습니다.
2. **DAT 파싱** — 각 행에서 타임스탬프(μs)와 원시값(raw integer)을 읽고, `actual = raw × multiplier + offset` 공식으로 실제 물리 값으로 변환합니다.
3. **타임스탬프 변환** — μs 단위 정수를 `timeMult`로 조정한 뒤 ms로 변환합니다.
4. **트리거 오프셋** — 기록 시작 시각과 트리거 시각의 차이를 ms로 계산합니다.

### `ComtradeChart.tsx` — 차트 컴포넌트

`ComtradeRecord`를 props로 받아 ECharts 차트를 렌더링합니다.

**핵심 설계:**

```
┌──────────────────────────────────────┐
│  Voltage (V)                         │  ← 전압 채널 (unit = 'V' 또는 'kV')
│  SBUS A ─────  SBUS B ─────  ...    │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Current (A)                         │  ← 전류 채널 (unit = 'A')
│  I-branch ─────  FAULT ─────  ...   │
└──────────────────────────────────────┘
[══════════════════════════════════════]  ← dataZoom 슬라이더
```

- **2개 grid** — 전압과 전류의 스케일이 달라 패널을 분리합니다.
- **동적 색상 팔레트** — 채널 수에 관계없이 순환 팔레트로 색을 할당합니다.
- **LTTB 다운샘플링** (`sampling: 'lttb'`) — 12,000+ 샘플을 화면 픽셀 수에 맞게 줄여 렌더링 성능을 유지합니다.
- **스크롤 범례** (`type: 'scroll'`) — 채널이 많을 때 범례를 스크롤할 수 있습니다.
- **Trigger 마커** — 사고 발생 시각을 노란 점선으로 표시합니다.

### `App.tsx` — 진입점

Vite의 `?raw` import로 파일을 텍스트 문자열로 읽어 파서에 전달합니다.

```typescript
import cfgText from './samples/ieee13_pv_l1c1b1f1.cfg?raw';
import datText from './samples/ieee13_pv_l1c1b1f1.dat?raw';

const comtradeData = parseComtrade(cfgText, datText);
```

> `?raw` — Vite가 파일 내용을 빌드 시점에 문자열로 번들링하는 방식입니다. 별도의 fetch 없이 동기적으로 파일을 사용할 수 있습니다.

---

## 차트 조작 방법

| 동작 | 방법 |
|------|------|
| 특정 구간 확대 | 하단 슬라이더 드래그 |
| 마우스 휠 줌 | 차트 위에서 스크롤 |
| 채널 숨기기/보이기 | 상단 범례 항목 클릭 |
| 값 확인 | 차트 위에 마우스 호버 |

---

## 다른 COMTRADE 파일 사용하기

`App.tsx`에서 import 경로만 변경하면 됩니다.

```typescript
// 다른 샘플로 교체
import cfgText from './samples/ieee13_pv_l2c1b2f3.cfg?raw';
import datText from './samples/ieee13_pv_l2c1b2f3.dat?raw';
```

직접 만든 파일을 사용하려면 `src/samples/` 에 `.cfg`와 `.dat`를 복사한 뒤 같은 방식으로 import합니다.  
파서가 지원하는 형식: **COMTRADE 1999 ASCII**

---

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| UI 프레임워크 | React 19 |
| 차트 | Apache ECharts + echarts-for-react |
| 빌드 도구 | Vite 8 |
| 언어 | TypeScript 6
