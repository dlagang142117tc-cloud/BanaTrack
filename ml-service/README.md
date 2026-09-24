# BanaTrack ML Service

Python service for the vision/fusion model: YOLOv8 (Ultralytics) training scripts,
the multimodal fusion pipeline, and a FastAPI inference endpoint that the `web`
app calls when a photo is submitted.

Not started yet — this is a placeholder for build-order steps 4-9
(data audit, baseline models, fused model, calibration, FastAPI serving layer).
Training happens in Google Colab; this folder will hold the serving code and
any scripts shared between Colab and the deployed service.
