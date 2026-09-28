"""Export FlyVis model responses to the authors' standard visual stimuli."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from flyvis import NetworkView, results_dir
from flyvis.datasets.flashes import Flashes
from flyvis.datasets.moving_bar import MovingEdge


def main() -> None:
    network = NetworkView(results_dir / "flow/0000/000").init_network()
    nodes = network.connectome.nodes.to_df()
    central = nodes.loc[(nodes.u == 0) & (nodes.v == 0)].sort_values("type")
    types = central["type"].astype(str).tolist()
    indices = central["index"].to_numpy(dtype=int)
    receptors = nodes.loc[nodes["type"] == "R1"].sort_values("index")
    coordinates = receptors[["u", "v"]].to_numpy(dtype=int).tolist()

    flashes = Flashes(
        dynamic_range=[0, 1], t_stim=1.0, t_pre=1.0, dt=1 / 200,
        radius=[-1, 6], alternations=(0, 1, 0),
    )
    edges = MovingEdge(
        offsets=[-10, 11], intensities=[1], speeds=[19], height=80,
        post_pad_mode="continue", t_pre=1.0, t_post=1.0, dt=1 / 200,
        angles=[0, 180],
    )
    edge_rows = edges.arg_df.reset_index(drop=True)
    samples = [
        ("bright", "밝은 점", flashes, 3),
        ("dark", "어두운 점", flashes, 1),
        ("edge_0", "밝은 경계 · 0°", edges, int(edge_rows.index[edge_rows.angle == 0][0])),
        ("edge_180", "밝은 경계 · 180°", edges, int(edge_rows.index[edge_rows.angle == 180][0])),
    ]
    exported = {
        "source": "TuragaLab/flyvis, pretrained flow/0000/000",
        "source_url": "https://github.com/TuragaLab/flyvis",
        "unit": "model voltage change (a.u.)",
        "cell_types": types,
        "coordinates": coordinates,
        "stimuli": {},
    }
    for key, label, dataset, sample in samples:
        movie = torch.as_tensor(dataset[sample], dtype=torch.float32)
        if movie.ndim == 2:
            movie = movie[:, None, :]
        if movie.ndim != 3 or movie.shape[-1] != len(coordinates):
            raise ValueError(f"Unexpected stimulus shape: {tuple(movie.shape)}")
        with torch.no_grad():
            initial = network.fade_in_state(1.0, dataset.dt, movie[[0]])
            response = network.simulate(movie[None], dataset.dt, initial_state=initial)
        voltage = response[0].index_select(1, torch.as_tensor(indices)).detach().cpu().numpy()
        if voltage.shape != (len(movie), len(types)):
            raise ValueError(f"Unexpected response shape: {voltage.shape}")
        baseline = voltage[: round(1.0 / dataset.dt)].mean(axis=0)
        stride = 5
        exported["stimuli"][key] = {
            "label": label,
            "dt": dataset.dt * stride,
            "baseline_s": 1.0,
            "frames": np.round(movie[::stride, 0].numpy(), 3).tolist(),
            "voltage_change": np.round(voltage[::stride] - baseline, 5).tolist(),
        }
        print(key, len(exported["stimuli"][key]["frames"]), "frames", flush=True)

    destination = Path("web/data/responses.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(exported, separators=(",", ":")), encoding="utf-8")
    print(destination, destination.stat().st_size, "bytes", flush=True)


if __name__ == "__main__":
    main()
