# fly-simul

FlyGym 2.1.0으로 3차원 초파리의 **시각 입력에 따른 걷기 변화**를 관찰하는 첫 실험이다.

빨간 공을 왼쪽, 오른쪽 또는 놓지 않은 상태에서 각각 실행한다. FlyGym의 양쪽 눈 카메라 영상에서 빨간 픽셀의 비율을 읽고, 좌우 다리 구동 신호의 크기를 조절한다. 다리 관절 움직임과 물리 계산에는 FlyGym의 `HybridTurningController`와 MuJoCo를 사용한다. 현재 시각-행동 제어는 간단한 **규칙**이며, 실제 초파리 연결망을 실행하지 않는다.

## 실행

Python 3.12-3.14가 필요하다. 가상환경에서:

```bash
python -m pip install -r requirements.txt
python simulate.py --duration 2 --video
```

화면 없는 서버에서는 OSMesa를 설치하고 실행 전에 `MUJOCO_GL=osmesa`와 `PYOPENGL_PLATFORM=osmesa`를 설정한다. FlyGym은 처음 실행할 때 몸체 메시 데이터를 내려받는다.

`results/none.csv`, `results/left.csv`, `results/right.csv`에 시간, 몸통 위치, 양쪽 눈의 빨간색 비율, 좌우 구동 신호가 기록된다. `--video`를 주면 각 조건의 몸 카메라 영상도 저장된다. 짧은 실행은 `python simulate.py --target left --duration 0.1 --output results`로 확인할 수 있다.

## 판정과 다음 단계

왼쪽과 오른쪽 자극의 눈 입력과 경로가 서로 달라지는지 먼저 확인한다. 물체가 영상에 잡히지 않으면 `red_left`, `red_right`가 모두 0으로 기록되므로 위치와 조명을 먼저 조절해야 한다. 그다음 실제 시각 회로의 입력·출력 뉴런 대응을 검증하고, 동일한 환경에서 연결망 제어기 및 연결을 섞은 대조군을 비교한다. 연결망을 붙이기 전의 행동 변화는 규칙 기반 제어 결과로만 해석한다.

FlyGym: https://github.com/NeLy-EPFL/flygym (Apache-2.0). 이 저장소는 FlyGym 코드를 복사하지 않고 패키지를 사용한다.
