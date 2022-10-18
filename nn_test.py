import torch
import onnx

model = onnx.load("./test_model.onnx")
onnx.checker.check_model(model)

print(model.)