"""只查询 Win32 窗口属性和鼠标命中区域，不发送输入或修改系统设置。"""
import ctypes
import json
import sys
from ctypes import wintypes

window = int(sys.argv[1])
ball_x, ball_y = float(sys.argv[2]), float(sys.argv[3])
user32 = ctypes.WinDLL('user32', use_last_error=True)
gdi32 = ctypes.WinDLL('gdi32', use_last_error=True)
user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
user32.GetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.GetWindowLongPtrW.restype = ctypes.c_ssize_t
user32.GetDpiForWindow.argtypes = [wintypes.HWND]
user32.GetDpiForWindow.restype = wintypes.UINT
user32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
user32.WindowFromPoint.argtypes = [wintypes.POINT]
user32.WindowFromPoint.restype = wintypes.HWND
user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
user32.GetAncestor.restype = wintypes.HWND
user32.GetWindowRgn.argtypes = [wintypes.HWND, wintypes.HRGN]
gdi32.CreateRectRgn.argtypes = [ctypes.c_int] * 4
gdi32.CreateRectRgn.restype = wintypes.HRGN
gdi32.PtInRegion.argtypes = [wintypes.HRGN, ctypes.c_int, ctypes.c_int]
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
scale = user32.GetDpiForWindow(window) / 96
center = wintypes.POINT(round(ball_x * scale), round(ball_y * scale))
corner = wintypes.POINT(2, 2)
region = gdi32.CreateRectRgn(0, 0, 0, 0)
has_region = user32.GetWindowRgn(window, region) != 0
center_in_region = bool(gdi32.PtInRegion(region, center.x, center.y))
corner_outside_region = not bool(gdi32.PtInRegion(region, corner.x, corner.y))
gdi32.DeleteObject(region)
user32.ClientToScreen(window, ctypes.byref(center))
user32.ClientToScreen(window, ctypes.byref(corner))
center_hit = user32.GetAncestor(user32.WindowFromPoint(center), 2)
corner_hit = user32.GetAncestor(user32.WindowFromPoint(corner), 2)
print(json.dumps({
    'topmost': bool(user32.GetWindowLongPtrW(window, -20) & 0x8),
    'hasNativeRegion': has_region,
    'ballInRegion': center_in_region,
    'transparentCornerExcluded': corner_outside_region,
    'ballHitsWindow': center_hit == window,
    'transparentCornerPassesThrough': corner_hit != window,
    'dpi': round(scale * 96),
}))
