# -*- coding: utf-8 -*-
# 同じ Wi-Fi のスマホ・タブレットからこのアプリを開くための簡易サーバー（お試し用）。
# 使い方: 「スマホで試す.bat」をダブルクリック → 出た URL をスマホのブラウザで開く。止める時は窓を閉じる。
# 注意: データは開いた端末ごとに別々に保存されます（PC とスマホで共有はされません）。
import http.server
import os
import socket
import sys

PORT = 8766
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # 実際には送らない。経路を決めるだけ
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


Handler.extensions_map.update({".js": "text/javascript; charset=utf-8",
                               ".json": "application/json; charset=utf-8",
                               ".webmanifest": "application/manifest+json; charset=utf-8",
                               ".html": "text/html; charset=utf-8",
                               ".css": "text/css; charset=utf-8"})

if __name__ == "__main__":
    ip = lan_ip()
    print("")
    print("  栄養・食事管理 — スマホで試す")
    print("  ------------------------------------------")
    print("  このPCで:      http://localhost:%d/" % PORT)
    print("  同じWi-Fiから: http://%s:%d/" % (ip, PORT))
    print("")
    print("  スマホのブラウザで上の URL を開いてください。")
    print("  ※ http なので「ホーム画面に追加」やオフライン保存は効きません（https が要ります）。")
    print("  ※ データは端末ごとに別です。PC のデータは見えません。")
    print("  止める時はこの窓を閉じてください。")
    print("")
    try:
        http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
