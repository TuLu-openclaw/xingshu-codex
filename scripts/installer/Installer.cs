using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("星枢破甲工具 安装包")]
[assembly: AssemblyDescription("星枢破甲工具 安装包")]
[assembly: AssemblyProduct("星枢破甲工具")]
[assembly: AssemblyCompany("星枢[未来科技]")]
[assembly: AssemblyCopyright("Copyright © 星枢[未来科技]")]
[assembly: AssemblyTrademark("星枢")]
[assembly: AssemblyFileVersion("5.0.0.0")]
[assembly: AssemblyVersion("5.0.0.0")]

namespace XingShuInstaller
{
    /// <summary>把自己尾部附加的 zip 载荷当只读流打开。</summary>
    internal sealed class SubStream : Stream
    {
        private readonly FileStream _fs;
        private readonly long _start;
        private readonly long _length;
        private long _pos;

        public SubStream(string path, long start, long length)
        {
            _fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            _start = start;
            _length = length;
            _fs.Seek(start, SeekOrigin.Begin);
        }

        public override bool CanRead { get { return true; } }
        public override bool CanSeek { get { return true; } }
        public override bool CanWrite { get { return false; } }
        public override long Length { get { return _length; } }
        public override long Position
        {
            get { return _pos; }
            set { _pos = value; _fs.Seek(_start + value, SeekOrigin.Begin); }
        }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count)
        {
            long left = _length - _pos;
            if (left <= 0) return 0;
            if (count > left) count = (int)left;
            int n = _fs.Read(buffer, offset, count);
            _pos += n;
            return n;
        }
        public override long Seek(long offset, SeekOrigin origin)
        {
            long t;
            if (origin == SeekOrigin.Begin) t = offset;
            else if (origin == SeekOrigin.Current) t = _pos + offset;
            else t = _length + offset;
            Position = t;
            return _pos;
        }
        public override void SetLength(long value) { throw new NotSupportedException(); }
        public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
        protected override void Dispose(bool disposing)
        {
            if (disposing) _fs.Dispose();
            base.Dispose(disposing);
        }
    }

    internal static class Program
    {
        private const string Magic = "XSHUPKG1";
        private const int TrailerSize = 32;
        private const string AppName = "星枢破甲工具";
        private const string Publisher = "星枢[未来科技]";
        private const string Version = "5.0.0";

        [STAThread]
        private static int Main(string[] args)
        {
            bool silent = false, noLaunch = false, uninstall = false;
            string target = null, extractOnly = null;
            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i].ToLowerInvariant();
                if (a == "/silent" || a == "-silent") silent = true;
                else if (a == "/nolaunch" || a == "-nolaunch") noLaunch = true;
                else if (a == "/uninstall" || a == "-uninstall") uninstall = true;
                else if ((a == "/dir" || a == "-dir") && i + 1 < args.Length) target = args[++i];
                else if ((a == "/extract" || a == "-extract") && i + 1 < args.Length) extractOnly = args[++i];
            }

            string self = Assembly.GetExecutingAssembly().Location;
            long offset, length;
            if (!ReadTrailer(self, out offset, out length))
            {
                MessageBox.Show("安装包已损坏（找不到载荷）。请重新下载。", AppName,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 2;
            }

            if (target == null)
                target = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName);

            try
            {
                if (extractOnly != null)
                {
                    Extract(self, offset, length, extractOnly, null, null);
                    Console.WriteLine("extracted to " + extractOnly);
                    return 0;
                }

                if (uninstall)
                {
                    Uninstall(target);
                    return 0;
                }

                if (silent)
                {
                    System.Collections.Generic.List<string> warn = new System.Collections.Generic.List<string>();
                    Install(self, offset, length, target, null, null, warn);
                    foreach (string w in warn) Console.Error.WriteLine("[warn] " + w);
                    if (!noLaunch) Launch(target);
                    return 0;
                }

                return RunGui(self, offset, length, target, noLaunch);
            }
            catch (Exception ex)
            {
                if (silent) { Console.Error.WriteLine(ex.Message); return 1; }
                MessageBox.Show("安装失败：" + ex.Message, AppName,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        private static bool ReadTrailer(string exe, out long offset, out long length)
        {
            offset = 0; length = 0;
            using (FileStream fs = new FileStream(exe, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                if (fs.Length < TrailerSize + 4) return false;
                fs.Seek(-TrailerSize, SeekOrigin.End);
                byte[] b = new byte[TrailerSize];
                if (fs.Read(b, 0, TrailerSize) != TrailerSize) return false;
                string magic = Encoding.ASCII.GetString(b, 0, 8);
                if (magic != Magic) return false;
                offset = BitConverter.ToInt64(b, 8);
                length = BitConverter.ToInt64(b, 16);
                if (offset <= 0 || length <= 0 || offset + length > fs.Length) return false;
                return true;
            }
        }

        private static void Extract(string self, long offset, long length, string target,
                                    ProgressBar bar, Label label)
        {
            Directory.CreateDirectory(target);
            using (SubStream sub = new SubStream(self, offset, length))
            using (ZipArchive zip = new ZipArchive(sub, ZipArchiveMode.Read, true))
            {
                int total = zip.Entries.Count;
                int done = 0;
                foreach (ZipArchiveEntry e in zip.Entries)
                {
                    string full = Path.Combine(target, e.FullName.Replace('/', Path.DirectorySeparatorChar));
                    if (e.FullName.EndsWith("/"))
                    {
                        Directory.CreateDirectory(full);
                        continue;
                    }
                    string dir = Path.GetDirectoryName(full);
                    if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                    using (Stream src = e.Open())
                    using (FileStream dst = new FileStream(full, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        byte[] buf = new byte[81920];
                        int n;
                        while ((n = src.Read(buf, 0, buf.Length)) > 0)
                            dst.Write(buf, 0, n);
                    }
                    done++;
                    if (bar != null && done % 20 == 0)
                    {
                        int pct = (int)(done * 100L / Math.Max(1, total));
                        BeginSet(bar, pct);
                        BeginSet(label, "正在解压 " + done + " / " + total);
                    }
                }
            }
        }

        private static void BeginSet(Control c, string text)
        {
            if (c == null || c.IsDisposed) return;
            c.BeginInvoke((MethodInvoker)delegate { if (!c.IsDisposed) c.Text = text; });
        }

        private static void BeginSet(ProgressBar bar, int value)
        {
            if (bar == null || bar.IsDisposed) return;
            bar.BeginInvoke((MethodInvoker)delegate
            {
                if (!bar.IsDisposed) bar.Value = Math.Min(100, Math.Max(0, value));
            });
        }

        private static void Install(string self, long offset, long length, string target,
                                    ProgressBar bar, Label label, System.Collections.Generic.List<string> warnings)
        {
            if (Directory.Exists(target))
            {
                try { Directory.Delete(target, true); }
                catch (Exception ex) { throw new IOException("无法覆盖旧安装目录：" + ex.Message); }
            }
            Extract(self, offset, length, target, bar, label);
            WriteUninstallScripts(target);

            // 快捷方式与注册表项失败不中断安装：企业策略 / 只读桌面 / 无 COM 环境下
            // 主体文件已经就位，用户仍可手动进目录双击运行。失败原因收集后统一提示。
            try
            {
                CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                                            AppName + ".lnk"), target);
            }
            catch (Exception ex) { warnings.Add("桌面快捷方式创建失败：" + Msg(ex)); }

            try
            {
                CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                                            AppName + ".lnk"), target);
            }
            catch (Exception ex) { warnings.Add("开始菜单快捷方式创建失败：" + Msg(ex)); }

            try { WriteRegistry(target); }
            catch (Exception ex) { warnings.Add("卸载项注册失败：" + Msg(ex)); }

            if (warnings.Count > 0)
            {
                try
                {
                    File.WriteAllText(Path.Combine(target, "install-warnings.txt"),
                                      string.Join("\r\n", warnings.ToArray()), new UTF8Encoding(true));
                }
                catch { }
            }
        }

        private static void Launch(string target)
        {
            string exe = Path.Combine(target, AppName + ".exe");
            if (File.Exists(exe))
                Process.Start(new ProcessStartInfo(exe) { WorkingDirectory = target });
        }

        /// <summary>反射调 COM 抛的是 TargetInvocationException，取内层才是真实原因。</summary>
        private static string Msg(Exception ex)
        {
            TargetInvocationException tie = ex as TargetInvocationException;
            if (tie != null && tie.InnerException != null) return tie.InnerException.Message;
            return ex.Message;
        }

        private static void CreateShortcut(string lnkPath, string target)
        {
            Type t = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(t);
            object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnkPath });
            Type st = sc.GetType();
            st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { Path.Combine(target, AppName + ".exe") });
            st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { target });
            st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { Path.Combine(target, AppName + ".exe") + ",0" });
            st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { AppName });
            st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
        }

        private static void WriteRegistry(string target)
        {
            Microsoft.Win32.RegistryKey k = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + AppName);
            if (k == null) return;
            string exe = Path.Combine(target, AppName + ".exe");
            k.SetValue("DisplayName", AppName);
            k.SetValue("DisplayVersion", Version);
            k.SetValue("Publisher", Publisher);
            k.SetValue("DisplayIcon", exe + ",0");
            k.SetValue("InstallLocation", target);
            k.SetValue("UninstallString", "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"" +
                                          Path.Combine(target, "uninstall.ps1") + "\"");
            k.SetValue("QuietUninstallString", "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"" +
                                               Path.Combine(target, "uninstall.ps1") + "\" -Quiet");
            k.SetValue("NoModify", 1, Microsoft.Win32.RegistryValueKind.DWord);
            k.SetValue("NoRepair", 1, Microsoft.Win32.RegistryValueKind.DWord);
            k.Close();
        }

        private static void WriteUninstallScripts(string target)
        {
            string ps = string.Join("\r\n", new string[]
            {
                "$ErrorActionPreference = 'SilentlyContinue'",
                "$dir  = Split-Path -Parent $MyInvocation.MyCommand.Definition",
                "$name = '" + AppName + "'",
                "$desk = [Environment]::GetFolderPath('Desktop')",
                "$menu = [Environment]::GetFolderPath('Programs')",
                "Remove-Item -LiteralPath (Join-Path $desk ($name + '.lnk')) -Force",
                "Remove-Item -LiteralPath (Join-Path $menu ($name + '.lnk')) -Force",
                "Remove-Item -LiteralPath ('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' + $name) -Recurse -Force",
                "$cmd = 'timeout /t 2 >nul & rmdir /s /q \"' + $dir + '\"'",
                "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WindowStyle Hidden",
                "Write-Host '已卸载 " + AppName + "'",
                ""
            });
            File.WriteAllText(Path.Combine(target, "uninstall.ps1"), ps,
                              new UTF8Encoding(true));
            File.WriteAllText(Path.Combine(target, "卸载" + AppName + ".bat"),
                              "@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0uninstall.ps1\"\r\npause\r\n",
                              new UTF8Encoding(false));
        }

        private static void Uninstall(string target)
        {
            string ps = Path.Combine(target, "uninstall.ps1");
            if (File.Exists(ps))
                Process.Start(new ProcessStartInfo("powershell.exe",
                    "-NoProfile -ExecutionPolicy Bypass -File \"" + ps + "\""));
        }

        private static int RunGui(string self, long offset, long length, string target, bool noLaunch)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            using (Form f = new Form())
            {
                f.Text = AppName + " 安装程序";
                f.ClientSize = new Size(460, 150);
                f.FormBorderStyle = FormBorderStyle.FixedDialog;
                f.MaximizeBox = false;
                f.MinimizeBox = false;
                f.StartPosition = FormStartPosition.CenterScreen;
                f.BackColor = Color.White;
                f.Icon = System.Drawing.Icon.ExtractAssociatedIcon(self);

                Label title = new Label();
                title.Text = AppName + "  " + Version;
                title.Font = new Font("Microsoft YaHei UI", 12F, FontStyle.Bold);
                title.SetBounds(20, 16, 420, 26);
                f.Controls.Add(title);

                Label sub = new Label();
                sub.Text = "安装到：" + target;
                sub.Font = new Font("Microsoft YaHei UI", 8.5F);
                sub.ForeColor = Color.Gray;
                sub.SetBounds(20, 46, 420, 40);
                f.Controls.Add(sub);

                ProgressBar bar = new ProgressBar();
                bar.SetBounds(20, 92, 420, 12);
                bar.Maximum = 100;
                f.Controls.Add(bar);

                Label status = new Label();
                status.Text = "准备中…";
                status.Font = new Font("Microsoft YaHei UI", 8.5F);
                status.SetBounds(20, 110, 420, 20);
                f.Controls.Add(status);

                bool ok = false;
                Exception error = null;
                System.Collections.Generic.List<string> warnings = new System.Collections.Generic.List<string>();
                f.Shown += delegate
                {
                    ThreadPool.QueueUserWorkItem(delegate
                    {
                        try { Install(self, offset, length, target, bar, status, warnings); ok = true; }
                        catch (Exception ex) { error = ex; }
                        finally
                        {
                            if (!f.IsDisposed)
                                f.BeginInvoke((MethodInvoker)delegate
                                {
                                    if (!f.IsDisposed) f.Close();
                                });
                        }
                    });
                };

                Application.Run(f);

                if (error != null)
                {
                    MessageBox.Show("安装失败：" + error.Message, AppName,
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 1;
                }
                if (!ok) return 1;

                if (warnings.Count > 0)
                {
                    MessageBox.Show("安装完成，但有以下项目未能完成：\r\n\r\n" + string.Join("\r\n", warnings.ToArray()) +
                                    "\r\n\r\n程序文件已就位，可直接到安装目录运行。", AppName,
                                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }

                if (!noLaunch &&
                    MessageBox.Show("安装完成。是否立即运行 " + AppName + "？", AppName,
                        MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                {
                    Launch(target);
                }
                return 0;
            }
        }
    }
}
