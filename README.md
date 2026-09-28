# Fly Vision · 시각 뉴런 반응

[웹에서 보기](https://sihoo7005.github.io/fly-simul/)

공개 [FlyVis](https://github.com/TuragaLab/flyvis) 시각 신경계 모델에 공식 점멸·이동 경계 자극을 주고, 뉴런 유형별 예측 전압 변화를 표시한다. 기존의 3D 보행 및 빨간 픽셀 행동 규칙 실험을 대체한다.

## 범위

- 연결 구조: FlyVis의 초파리 **시각계 일부** 연결망. 전체 뇌 연결망이 아니다.
- 값: 학습된 모델이 계산한 뉴런 전압 변화. 실제 초파리에서 측정한 발화가 아니다.
- 입력: FlyVis의 `Flashes`, `MovingEdge` 자극 생성기. 모델은 밝기 입력을 받으며 색상 인식이나 행동 출력은 없다.
- 표시: 각 뉴런 유형의 중앙 세포 하나. 자극 전 1초 평균을 뺀 값을 표시한다. 반응이 상승하거나 하강해도 행동을 임의로 배정하지 않는다.

## 결과 생성

Python 3.11 환경에서:

```bash
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
flyvis download-pretrained --skip_large_files
python export_responses.py
```

`web/data/responses.json`이 생성된다. `python -m http.server --directory web`으로 로컬에서 볼 수 있다. GitHub Actions는 동일한 명령으로 데이터를 계산하고 GitHub Pages에 배포한다. FlyVis 코드는 MIT 라이선스이며 저장소에 복사하지 않고 패키지로 사용한다.
