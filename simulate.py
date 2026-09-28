"""A small closed-loop vision and walking experiment using FlyGym 2.1."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np


TARGET_Y = {"none": None, "left": 2.5, "right": -2.5}


def red_fraction_per_eye(frames: np.ndarray) -> tuple[float, float]:
    """Measure the visible red target in the left and right eye images."""
    images = np.asarray(frames)
    if images.ndim != 4 or images.shape[0] != 2 or images.shape[-1] != 3:
        raise ValueError("expected two RGB eye images")
    rgb = images.astype(np.float32)
    red = (rgb[..., 0] > 100) & (rgb[..., 0] > 1.5 * rgb[..., 1]) & (
        rgb[..., 0] > 1.5 * rgb[..., 2]
    )
    return tuple(float(value) for value in red.mean(axis=(1, 2)))


def walking_signal(left: float, right: float) -> np.ndarray:
    """Drive the contralateral legs faster to turn toward the red target."""
    if left < 0 or right < 0 or not np.isfinite([left, right]).all():
        raise ValueError("visual fractions must be finite and nonnegative")
    if left + right < 1e-5:
        return np.array([0.8, 0.8])
    turn = 0.4 * (left - right) / (left + right)
    return np.array([0.8 - turn, 0.8 + turn])


def run(target: str, duration: float, output: Path, video: bool) -> None:
    from flygym import Simulation
    from flygym.anatomy import BodySegment, ContactBodiesPreset
    from flygym.compose import FlatGroundWorld
    from flygym.utils.math import Rotation3D
    from flygym.utils.mjcf import GEOM_TYPES
    from flygym_demo.complex_terrain import (
        HybridTurningController,
        HybridControllerObservation,
        LocomotionAction,
        PreprogrammedSteps,
        apply_locomotion_action,
        make_locomotion_fly,
    )

    fly = make_locomotion_fly(name="fly", add_adhesion=True, colorize=True)
    fly.add_vision()
    camera = fly.add_tracking_camera(name="body_cam") if video else None
    world = FlatGroundWorld()
    if TARGET_Y[target] is not None:
        world.mjcf_root.worldbody.add_geom(
            name="red_target",
            type=GEOM_TYPES["sphere"],
            pos=(4.0, TARGET_Y[target], 0.8),
            size=(0.7, 0.7, 0.7),
            rgba=(1.0, 0.02, 0.02, 1.0),
            contype=0,
            conaffinity=0,
        )
    world.add_fly(
        fly,
        [0, 0, 0.8],
        Rotation3D("quat", [1, 0, 0, 0]),
        bodysegs_with_ground_contact=ContactBodiesPreset.TIBIA_TARSUS_ONLY,
        add_ground_contact_sensors=False,
    )

    sim = Simulation(world)
    if camera is not None:
        sim.set_renderer([camera], playback_speed=0.2, output_fps=25)
    steps = PreprogrammedSteps()
    dofs = fly.get_actuated_jointdofs_order("position")
    controller = HybridTurningController(
        timestep=sim.timestep, preprogrammed_steps=steps, output_dof_order=dofs
    )
    sim.reset()
    controller.reset(seed=0)
    apply_locomotion_action(
        sim,
        fly.name,
        LocomotionAction(
            joint_angles=steps.default_pose_by_dof_order(dofs),
            adhesion_onoff=np.ones(6, dtype=bool),
        ),
    )
    sim.warmup()

    thorax_index = fly.get_bodysegs_order().index(BodySegment("c_thorax"))
    sample_every = max(1, round(0.05 / sim.timestep))
    signal = np.array([0.8, 0.8])
    rows = []
    for tick in range(round(duration / sim.timestep)):
        if tick % sample_every == 0:
            red_left, red_right = red_fraction_per_eye(sim.get_raw_vision(fly.name))
            signal = walking_signal(red_left, red_right)
            x, y, z = sim.get_body_positions(fly.name)[thorax_index]
            rows.append((tick * sim.timestep, x, y, z, red_left, red_right, *signal))

        observation = HybridControllerObservation.from_sim(sim, fly.name)
        action = controller.step(signal, observation)
        apply_locomotion_action(sim, fly.name, action)
        sim.step()
        if video:
            sim.render_as_needed()

    path = output / f"{target}.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("time_s", "x_mm", "y_mm", "z_mm", "red_left", "red_right", "drive_left", "drive_right"))
        writer.writerows(rows)
    if video:
        sim.renderer.save_video(output / f"{target}.mp4")
    print(f"{target}: {len(rows)} visual samples; saved {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="FlyGym 2.1 visual walking experiment")
    parser.add_argument("--target", choices=(*TARGET_Y, "all"), default="all")
    parser.add_argument("--duration", type=float, default=2.0, help="seconds per run")
    parser.add_argument("--output", type=Path, default=Path("results"))
    parser.add_argument("--video", action="store_true", help="save a body-camera MP4")
    args = parser.parse_args()
    if not np.isfinite(args.duration) or args.duration <= 0:
        parser.error("--duration must be finite and positive")
    args.output.mkdir(parents=True, exist_ok=True)
    targets = TARGET_Y if args.target == "all" else (args.target,)
    for target in targets:
        run(target, args.duration, args.output, args.video)


if __name__ == "__main__":
    main()
