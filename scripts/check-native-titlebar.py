"""桌面集成测试：查询原生标题栏，或向指定测试 HWND 投递原生窗口命令。
不移动系统鼠标，不修改 Windows 主题/设置，不读取应用数据。
"""
import ctypes
import json
import sys
import winreg
import struct
import zlib
from ctypes import wintypes

window = int(sys.argv[1])
command = sys.argv[2] if len(sys.argv) > 2 else 'inspect'
user32 = ctypes.WinDLL('user32', use_last_error=True)
dwm = ctypes.WinDLL('dwmapi', use_last_error=True)
user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
user32.GetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.GetWindowLongPtrW.restype = ctypes.c_ssize_t
user32.GetClassLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.GetClassLongPtrW.restype = ctypes.c_size_t
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
user32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.SendMessageW.restype = ctypes.c_ssize_t
user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
dwm.DwmGetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
rect = wintypes.RECT()
if not user32.GetWindowRect(window, ctypes.byref(rect)):
    raise OSError('无法查询测试窗口')
client = wintypes.POINT(0, 0)
user32.ClientToScreen(window, ctypes.byref(client))
caption_point = ((rect.left + rect.right) // 2, (rect.top + client.y) // 2)

def packed(x, y):
    return (x & 0xffff) | ((y & 0xffff) << 16)

if command != 'inspect':
    if command == 'capture':
        # PrintWindow 包含非客户区；Electron 的窗口缩略图在部分 Windows 上只有网页内容。
        gdi = ctypes.WinDLL('gdi32', use_last_error=True)
        user32.GetWindowDC.argtypes = [wintypes.HWND]
        user32.GetWindowDC.restype = wintypes.HDC
        user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
        user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
        gdi.CreateCompatibleDC.argtypes = [wintypes.HDC]
        gdi.CreateCompatibleDC.restype = wintypes.HDC
        gdi.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
        gdi.CreateCompatibleBitmap.restype = wintypes.HBITMAP
        gdi.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
        gdi.SelectObject.restype = wintypes.HGDIOBJ
        gdi.DeleteDC.argtypes = [wintypes.HDC]
        gdi.DeleteObject.argtypes = [wintypes.HGDIOBJ]
        gdi.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT, wintypes.UINT, ctypes.c_void_p, ctypes.c_void_p, wintypes.UINT]
        width, height = rect.right - rect.left, rect.bottom - rect.top
        window_dc = user32.GetWindowDC(window)
        memory_dc = gdi.CreateCompatibleDC(window_dc)
        bitmap = gdi.CreateCompatibleBitmap(window_dc, width, height)
        old = gdi.SelectObject(memory_dc, bitmap)
        try:
            if not user32.PrintWindow(window, memory_dc, 2):
                raise OSError('无法捕获原生窗口')
            gdi.SelectObject(memory_dc, old)
            header = ctypes.create_string_buffer(struct.pack('<IiiHHIIiiII', 40, width, -height, 1, 32, 0, width * height * 4, 0, 0, 0, 0))
            pixels = ctypes.create_string_buffer(width * height * 4)
            if not gdi.GetDIBits(memory_dc, bitmap, 0, height, pixels, header, 0):
                raise OSError('无法读取窗口像素')
            frame = wintypes.RECT()
            dwm.DwmGetWindowAttribute(window, 9, ctypes.byref(frame), ctypes.sizeof(frame))
            left = max(0, frame.left - rect.left)
            right = min(width, frame.right - rect.left)
            top = max(0, frame.top - rect.top)
            bottom = max(top + 1, client.y - rect.top)
            out_width, out_height = right - left, bottom - top
            raw = pixels.raw
            rows = []
            for y in range(top, bottom):
                source = raw[(y * width + left) * 4:(y * width + right) * 4]
                rgb = bytearray(out_width * 3)
                rgb[0::3], rgb[1::3], rgb[2::3] = source[2::4], source[1::4], source[0::4]
                rows.append(b'\x00' + rgb)
            def chunk(kind, data):
                return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
            png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', out_width, out_height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')
            with open(sys.argv[3], 'wb') as output:
                output.write(png)
            offset = (((top + bottom) // 2) * width + width // 2) * 4
            print(json.dumps({'rgb': list(raw[offset:offset + 3][::-1]), 'width': out_width, 'height': out_height, 'method': 'PrintWindow'}))
        finally:
            gdi.DeleteObject(bitmap)
            gdi.DeleteDC(memory_dc)
            user32.ReleaseDC(window, window_dc)
        sys.exit(0)
    if command == 'caption-double-click':
        accepted = user32.PostMessageW(window, 0x00A3, 2, packed(*caption_point))
    else:
        commands = {'minimize': 0xF020, 'maximize': 0xF030, 'restore': 0xF120, 'close': 0xF060}
        if command not in commands:
            raise ValueError('不支持的测试命令')
        accepted = user32.PostMessageW(window, 0x0112, commands[command], 0)
    print(json.dumps({'posted': bool(accepted)}))
    sys.exit(0)

class TitleBarInfo(ctypes.Structure):
    _fields_ = [('cbSize', wintypes.DWORD), ('rect', wintypes.RECT), ('states', wintypes.DWORD * 6), ('buttons', wintypes.RECT * 6)]

info = TitleBarInfo()
info.cbSize = ctypes.sizeof(info)
user32.SendMessageW(window, 0x033F, 0, ctypes.addressof(info))

def hit(x, y):
    return user32.SendMessageW(window, 0x0084, 0, packed(x, y))

def button_hit(index):
    box = info.buttons[index]
    return hit((box.left + box.right) // 2, (box.top + box.bottom) // 2) if box.right > box.left else None

dark = wintypes.BOOL()
dark_result = dwm.DwmGetWindowAttribute(window, 20, ctypes.byref(dark), ctypes.sizeof(dark))
text = ctypes.create_unicode_buffer(256)
user32.GetWindowTextW(window, text, len(text))
style = user32.GetWindowLongPtrW(window, -16)
icon = user32.SendMessageW(window, 0x007F, 2, 0) or user32.SendMessageW(window, 0x007F, 0, 0) or user32.GetClassLongPtrW(window, -14)
try:
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Themes\Personalize') as key:
        apps_light = winreg.QueryValueEx(key, 'AppsUseLightTheme')[0]
except OSError:
    apps_light = None

print(json.dumps({
    'title': text.value,
    'caption': (style & 0x00C00000) == 0x00C00000,
    'systemMenu': bool(style & 0x00080000),
    'resizeBorder': bool(style & 0x00040000),
    'minimizeButton': bool(style & 0x00020000),
    'maximizeButton': bool(style & 0x00010000),
    'hasIcon': bool(icon),
    'dwmDarkMode': bool(dark.value) if dark_result == 0 else None,
    'captionHit': hit(*caption_point),
    'leftResizeHit': hit(rect.left + 3, (rect.top + rect.bottom) // 2),
    'bottomResizeHit': hit((rect.left + rect.right) // 2, rect.bottom - 3),
    'minimizeHit': button_hit(2), 'maximizeHit': button_hit(3), 'closeHit': button_hit(5),
    'osAppsUseLightTheme': apps_light,
}))
