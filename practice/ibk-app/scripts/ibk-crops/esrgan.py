"""Real-ESRGAN (RRDBNet) 4배 업스케일 — basicsr 없이 torch 만으로 (CPU 로 충분: 작은 그림만 키움).

  python3 esrgan.py <모델.pth> <입력.png> <출력.png>

모델: RealESRGAN_x4plus_anime_6B.pth (그림·아이콘·글자에 맞음, 18MB)
      https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth
      사진이면 RealESRGAN_x4plus.pth (블록 23개). 블록 수는 가중치에서 알아냄
필요: torch(CPU 판으로 충분), numpy, Pillow
"""
import sys

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.nn import functional as F


class RDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        return self.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = RDB(nf, gc), RDB(nf, gc), RDB(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, nb, nf=64):
        super().__init__()
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


def load(path):
    sd = torch.load(path, map_location="cpu", weights_only=True)
    sd = sd.get("params_ema", sd.get("params", sd))
    nb = len({k.split(".")[1] for k in sd if k.startswith("body.")})
    net = RRDBNet(nb)
    net.load_state_dict(sd, strict=True)
    return net.eval()


@torch.no_grad()
def upscale(net, rgb):
    """rgb: HxWx3 uint8 → 4H x 4W x 3 uint8 (가장자리 번짐 줄이려고 반사 여백 8px)"""
    x = torch.from_numpy(rgb.astype(np.float32) / 255).permute(2, 0, 1)[None]
    x = F.pad(x, (8, 8, 8, 8), mode="reflect")
    y = net(x)[0, :, 32:-32, 32:-32].clamp(0, 1)
    return (y.permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)


if __name__ == "__main__":
    model, src, dst = sys.argv[1:4]
    torch.set_num_threads(4)
    Image.fromarray(upscale(load(model), np.asarray(Image.open(src).convert("RGB")))).save(dst)
