'use strict';
// Persian summaries of the actual definitions in Doc/matn_abzarha_claude_code.md
// and @deepseek-ai/dsh-tool-*/lib/index.js. No tool is invoked to describe it.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const builtin = {
 plugin_manager:'افزونه‌های همین پروفایل را فهرست، نصب، فعال، غیرفعال یا حذف می‌کند؛ تغییرها روی همهٔ چت‌های پروفایل اثر دارند و اجازه لازم است',
 subagent_fork:'کار را به یک ایجنتِ فرزند با سابقهٔ نوبت‌های کامل‌شدهٔ همین گفتگو می‌سپارد',
 exit_plan_mode:'برنامهٔ آماده را برای بررسیِ حبیب ارائه می‌کند و درخواستِ خروج از حالتِ برنامه‌ریزی می‌دهد',
 glob:'فایل‌ها را از روی الگوی نام و مسیر پیدا می‌کند',
 grep:'داخلِ فایل‌ها به دنبال متن یا الگوی جست‌وجو می‌گردد و شمارهٔ خط می‌دهد',
 Glob:'فایل‌ها را از روی الگوی نام و مسیر پیدا می‌کند',
 Grep:'در متنِ فایل‌ها جست‌وجو می‌کند و خط‌های مطابق را نشان می‌دهد',
 schedule_create:'یک کارِ زمان‌بندی‌شدهٔ تازه می‌سازد',
 schedule_list:'کارهای زمان‌بندی‌شده و وضعیتشان را فهرست می‌کند',
 schedule_view:'جزئیاتِ یک کارِ زمان‌بندی‌شده را می‌خواند',
 schedule_edit:'تنظیم‌های یک کارِ زمان‌بندی‌شده را تغییر می‌دهد',
 str_replace_editor:'متنِ فایل را می‌خواند، می‌سازد یا با جایگزینیِ بخش مشخص ویرایش می‌کند',
 todo_write:'فهرستِ کارهای همین اجرا و وضعیتِ انجامشان را ثبت می‌کند',
 pwsh:'فرمان را در محیطِ PowerShell اجرا می‌کند',
 workflow:'گردشِ کار را با اسکریپت و چند ایجنتِ هماهنگ اجرا می‌کند',
 ralph:'با دورهای محدود و ایجنتِ تازه، هدف را دنبال می‌کند',
 list_mcp_resources:'منابعِ خواندنیِ سرورهای MCP را فهرست می‌کند',
 list_mcp_resource_templates:'قالبِ منابعِ خواندنیِ MCP را برای دریافتِ پارامتر نشان می‌دهد',
 read_mcp_resource:'محتوای یک منبعِ MCP را از نشانی‌اش می‌خواند',
 mcp__hafeze__gashtan_dar_hafeze:'در حرف‌ها و کارهای گفتگوهای قبلیِ حبیب جست‌وجو می‌کند',
 mcp__computer_use__computer:'با اتصالِ کامپیوتر، صفحه و برنامه‌های حبیب را می‌خواند یا کنترل می‌کند',
 propose_action:'پیشنهاد را در کارتِ قابل تأیید به حبیب نشان می‌دهد؛ خودش اجرا نمی‌کند',
 session_reception:'دریافتِ پیام از چت‌های دیگر را برای همین چت روشن یا متوقف می‌کند',
 create_worktree:'شاخه و نسخهٔ کاریِ جدا از Git می‌سازد و پوشهٔ همین چت را به آن تغییر می‌دهد',
 model_hunter:'قیمت و کیفیتِ مسیرهای مدل DeepSeek در OpenRouter را بررسی و رتبه‌بندی می‌کند',
 Agent:'کار را به یک ایجنتِ جدا می‌سپارد و نتیجه‌اش را می‌گیرد',
 AskUserQuestion:'سؤال و گزینه‌ها را در پنجرهٔ سؤال به حبیب نشان می‌دهد',
 Bash:'فرمان را در ترمینال اجرا می‌کند',
 CronCreate:'برای همین چت یک کارِ زمان‌بندی‌شده می‌سازد',
 CronDelete:'یک کارِ زمان‌بندی‌شدهٔ همین چت را حذف می‌کند',
 CronList:'کارهایی را که برای این چت زمان‌بندی کرده‌ای نشان می‌دهد',
 DesignSync:'فایل‌های کتابخانهٔ طراحی را با پروژهٔ Claude Design هماهنگ می‌کند؛ به ورود و اجازه نیاز دارد',
 Edit:'بخش مشخصی از متنِ فایل را جایگزین می‌کند',
 EnterPlanMode:'چت را وارد حالتِ برنامه‌ریزی پیش از اجرا می‌کند',
 ExitPlanMode:'برنامهٔ آماده را برای خروج از حالت برنامه‌ریزی ارائه می‌کند',
 EnterWorktree:'یک نسخهٔ کاریِ جدا از مخزن برای این چت باز می‌کند',
 ExitWorktree:'از نسخهٔ کاریِ جدا خارج می‌شود و نگه‌داشتن یا حذفش را مدیریت می‌کند',
 ListAgents:'چت‌ها و ایجنت‌های قابل پیام‌دادن را فهرست می‌کند',
 Monitor:'رویداد یا خروجیِ یک منبع را در پس‌زمینه زیر نظر می‌گیرد',
 NotebookEdit:'سلولِ دفترچهٔ Jupyter را ویرایش یا اضافه و حذف می‌کند',
 PushNotification:'برای حبیب اعلان می‌فرستد',
 Read:'محتوای یک فایل را می‌خواند',
 RemoteTrigger:'محرکِ راه‌دور برای شروع یا بیدارکردن چت را مدیریت می‌کند',
 ReportFindings:'یافته‌های بررسی را به شکل ساخت‌یافته گزارش می‌دهد',
 ScheduleWakeup:'بیدارشدنِ بعدیِ ایجنت را زمان‌بندی می‌کند',
 SendMessage:'به یک چت یا ایجنتِ قابل دسترس پیام می‌فرستد',
 Skill:'دستورهای کاملِ یک اسکیل (روش انجام کار) را بار می‌کند',
 TaskStop:'کارِ پس‌زمینهٔ در حال اجرا را متوقف می‌کند',
 ToolSearch:'ابزارهای مورد نیاز را در فهرست ابزارهای قابل بارگذاری پیدا می‌کند',
 WebFetch:'متنِ یک صفحهٔ اینترنتی را از نشانی‌اش می‌خواند',
 WebSearch:'در اینترنت جست‌وجو می‌کند',
 Workflow:'مراحلِ یک گردش کار را با ایجنت‌ها اجرا می‌کند',
 Write:'فایل می‌سازد یا تمام محتوای فایل را جایگزین می‌کند',
 ListMcpResourcesTool:'منابعِ خواندنیِ اتصال‌های MCP را فهرست می‌کند',
 ReadMcpResourceTool:'یک منبعِ خواندنیِ MCP را می‌خواند',
 ReadMcpResourceDirTool:'فهرستِ یک پوشهٔ منبعِ MCP را می‌خواند',
 read:'محتوای فایل متنی را با شمارهٔ خط می‌خواند',
 write:'فایل متنی می‌سازد یا همهٔ متنش را جایگزین می‌کند',
 edit:'متن مشخصی را در فایل جایگزین می‌کند',
 apply_patch:'با یک تغییرنامه، فایل متنی می‌سازد، تغییر می‌دهد، جابه‌جا یا حذف می‌کند',
 read_image:'تصویرِ فایل را برای دیدنِ محتوایش می‌خواند',
 bash:'فرمان را در ترمینال اجرا می‌کند',
 web_search:'در اینترنت جست‌وجو می‌کند',
 web_fetch:'متنِ یک نشانی اینترنتی را می‌خواند',
 job_list:'کارهای پس‌زمینهٔ همین ایجنت و وضعیتشان را نشان می‌دهد',
 job_output:'خروجی تازه یا نتیجهٔ یک کارِ پس‌زمینه را می‌خواند',
 job_kill:'درخواستِ توقفِ یک کارِ پس‌زمینه را می‌فرستد',
 skill:'دستورهای کاملِ یک اسکیل (روش انجام کار) را بار می‌کند',
 list_agents:'درختِ ایجنت‌های این کار و وضعیتشان را نشان می‌دهد',
 send_message:'به یک ایجنت پیام می‌فرستد؛ ایجنتِ بیکار را ادامه می‌دهد',
 wait_agent:'منتظرِ پیام یا پایانِ کارِ ایجنت می‌ماند',
 interrupt_agent:'از یک ایجنت می‌خواهد کارِ فعلی‌اش را متوقف کند',
 subagent:'یک ایجنتِ فرزند برای انجامِ بخشی از کار می‌سازد',
 list_subagent_models:'مدل‌ها و میزان فکرکردنِ مجاز برای ایجنتِ فرزند را نشان می‌دهد',
 ask_user_question:'سؤال و گزینه‌ها را در پنجرهٔ سؤال به حبیب نشان می‌دهد',
 session_peers:'چت‌های قابل دسترس برای ارتباط را نشان می‌دهد',
 session_send:'به یک چتِ قابل دسترس پیام می‌فرستد',
 session_search:'در چت‌های قبلیِ همین پوشه جست‌وجو می‌کند',
 session_event_search:'در رویدادهای یک چتِ مجاز جست‌وجو می‌کند',
 session_trace:'ارتباطِ چت با والد و فرزندانش را می‌خواند',
 session_event_trace:'رابطه و جایگزین‌های یک رویدادِ چت را می‌خواند',
 session_event_read:'متنِ کامل یک رویدادِ مجازِ چت را می‌خواند',
 update_goal:'وضعیتِ هدفِ فعلی را به‌روز می‌کند',
 create_goal:'یک هدفِ کاریِ تازه ثبت می‌کند',
 get_goal:'وضعیت و بودجهٔ هدفِ فعلی را می‌خواند',
 office_render:'صفحهٔ سند، اسلاید یا ناحیهٔ جدول را به تصویر تبدیل می‌کند',
 office_convert:'قالبِ یک سند را تبدیل می‌کند و فایل موقت برمی‌گرداند',
 office_recalculate:'فرمول‌های فایل صفحه‌گسترده را دوباره محاسبه می‌کند',
 load_workspace_dependencies:'مسیرِ کتابخانه‌ها و برنامه‌های آمادهٔ محیطِ کار را می‌دهد',
 working_directory:'پوشهٔ کارِ فعلی را می‌خواند یا تغییر می‌دهد',
 present:'فایلِ آماده را به عنوان خروجیِ نهایی به حبیب معرفی می‌کند',
 terminal_open:'یک نشستِ ترمینالِ ماندگار برای همین ایجنت باز می‌کند',
 terminal_send:'متن یا فرمان را به ترمینالِ ماندگار می‌فرستد',
 terminal_read:'بخشی از خروجی ذخیره‌شدهٔ ترمینال را می‌خواند',
 terminal_signal:'سیگنالِ مجاز برای کنترلِ فرایندِ جلوی ترمینال می‌فرستد',
 terminal_close:'ترمینال و فرایندهای متعلق به آن را می‌بندد',
 terminal_list:'ترمینال‌های ماندگارِ همین ایجنت را نشان می‌دهد',
 cordis_inspect_list:'منابعِ بررسیِ ساختارِ افزونه‌ها و روش‌های خواندنی‌شان را نشان می‌دهد',
 cordis_inspect_query:'ساختار و قراردادِ یک قابلیتِ اعلام‌شدهٔ افزونه را فقط می‌خواند',
 team_task_create:'یک کارِ منتظر و بدون مسئول در بورد مشترکِ تیم می‌سازد',
 team_task_list:'کارهای مشترکِ تیم، مسئول و مانع‌هایشان را نشان می‌دهد',
 team_task_get:'آخرین جزئیاتِ یک کارِ مشترک را می‌خواند',
 team_task_update:'یک کارِ مشترک را با بررسیِ آخرین نسخه‌اش تغییر می‌دهد',
 'ralph-loop':'با دورهای محدود و ایجنتِ تازه، یک هدف را مرحله‌به‌مرحله دنبال می‌کند'
};
const plugins = {
 'data':'با SQL داده‌ها را بررسی می‌کند و از آن‌ها تحلیل، نمودار و داشبورد می‌سازد',
 'hads':'بعد از جواب، کارهای احتمالیِ بعدی را به صورت دکمه بالای کادرِ پیام پیشنهاد می‌دهد',
 'cowork-plugin-management':'افزونهٔ Claude را برای ابزارها و روشِ کارِ کاربر می‌سازد یا تنظیم می‌کند',
 '@local/dsh-advisor':'مصرف و تنظیم‌های چت را بررسی می‌کند و برای کمترشدنِ خرج پیشنهاد می‌دهد',
 '@local/dsh-claude-yeki':'قواعد و اتصالِ ابزارها را میان Claude Code و DeepSeek Harness مشترک می‌کند',
 '@local/dsh-nav':'فهرستِ پوشه‌ها و چت‌ها را در سرصفحهٔ چت نشان می‌دهد',
 '@local/dsh-rtl':'متنِ فارسی را راست‌به‌چپ می‌کند و پنل Aa و تنظیم‌های سه‌سطحی را فراهم می‌کند',
 '@local/dsh-session-guard':'پیام بین چت‌ها را با کنترلِ اجازه و پذیرشِ مقصد مدیریت می‌کند',
 '@local/dsh-side-panel':'کنارِ چت، شرحِ سادهٔ روند کار، آمار و هزینهٔ واقعی را نشان می‌دهد',
 '@local/model-hunter':'مسیرهای مدلِ DeepSeek در OpenRouter را بر پایهٔ قیمت و کیفیت رتبه‌بندی می‌کند',
 '@deepseek-ai/dsh-subagent-claude-code':'یک ایجنتِ Claude Code را برای یک اجرای جدا از راهِ Agent SDK به کار می‌گیرد',
 '@deepseek-ai/dsh-subagent-codex':'یک ایجنتِ Codex را برای یک اجرای جدا از راهِ app-server به کار می‌گیرد',
 'audit-context-building':'کد را تابع‌به‌تابع می‌خواند و فرض‌ها و وابستگی‌هایش را پیش از بررسیِ امنیت ثبت می‌کند',
 'browser-use':'وب‌سایت را با مرورگر واقعی می‌خواند و با فرم‌ها و دکمه‌هایش کار می‌کند',
 'building-secure-contracts':'ابزار و راهنمای بررسیِ امنیتِ قراردادهای هوشمند را فراهم می‌کند',
 'chrome-devtools-mcp':'با ابزارهای توسعهٔ Chrome صفحه را بررسی و مرورگر را کنترل می‌کند',
 'claude-code-setup':'کد پروژه را بررسی می‌کند و هوک، اسکیل و اتصالِ مناسب پیشنهاد می‌دهد',
 'claude-in-chrome-troubleshooting':'مشکلِ اتصالِ افزونهٔ Claude در Chrome را عیب‌یابی می‌کند',
 'differential-review':'تغییرهای کد و سابقهٔ Git را برای ایراد امنیتی بررسی می‌کند',
 'dimensional-analysis':'واحدها و مقیاسِ عددهای کد را برای یافتن اشتباه محاسباتی بررسی می‌کند',
 'discord':'پیام‌های Discord را با کنترلِ دسترسی به Claude Code وصل می‌کند',
 'entry-point-analyzer':'ورودی‌های قابل فراخوانیِ قرارداد که وضعیت را تغییر می‌دهند پیدا می‌کند',
 'fp-check':'درستیِ گزارشِ ایراد امنیتی را پیش از پذیرفتنش بررسی می‌کند',
 'frontend-design':'برای ساختِ ظاهر و رابطِ وب راهنمای طراحی می‌دهد',
 'hookify':'از الگوی گفتگو، قاعده و هوک برای جلوگیری از رفتار ناخواسته می‌سازد',
 'insecure-defaults':'تنظیم‌های پیش‌فرضِ ناامن، رمزِ ثابت و احراز هویتِ ضعیف را پیدا می‌کند',
 'mutation-testing':'آزمونِ خرابکاریِ عمدیِ کد را با mewt یا muton تنظیم می‌کند',
 'property-based-testing':'روشِ آزمودنِ ویژگی‌های عمومیِ برنامه با ورودی‌های گوناگون را راهنمایی می‌کند',
 'ralph-loop':'تا رسیدن به هدف، کار را در دورهای تکراری ادامه می‌دهد',
 'remember':'گفتگوها را برای حافظهٔ پیوسته استخراج و خلاصه می‌کند',
 'second-opinion':'تغییرهای کد را برای نظر دوم به Codex یا Gemini می‌دهد',
 'semgrep-rule-creator':'قاعدهٔ Semgrep برای یافتن الگوی ایراد در کد می‌سازد',
 'session-report':'از گفتگوهای محلی، گزارشِ مصرفِ توکن و کش و ابزار می‌سازد',
 'sharp-edges':'رابط‌ها و تنظیم‌هایی را پیدا می‌کند که احتمالِ اشتباهِ امنیتی دارند',
 'skill-creator':'اسکیل می‌سازد یا اصلاح می‌کند و کارایی‌اش را می‌سنجد',
 'spec-to-code-compliance':'کد را با تک‌تکِ الزام‌های مستندات مقایسه می‌کند',
 'static-analysis':'بدون اجرای برنامه، با CodeQL و Semgrep کد را برای ایراد بررسی می‌کند',
 'superpowers':'روش‌های آزمون، عیب‌یابی و همکاریِ برنامه‌نویسی را فراهم می‌کند',
 'supply-chain-risk-auditor':'خطرِ وابستگی‌های نرم‌افزار و تصاحبِ بسته‌ها را بررسی می‌کند',
 'swift-lsp':'زبانِ Swift را برای بررسی و پیمایشِ کد به محیط وصل می‌کند',
 'telegram':'پیام‌های Telegram را با کنترلِ دسترسی به Claude Code وصل می‌کند',
 'testing-handbook-skills':'روش‌های آزمایشِ امنیتِ نرم‌افزارِ Trail of Bits را فراهم می‌کند',
 'trailmark':'نقشهٔ ارتباطِ کد و مسیرهای اثرگذاریِ تغییرها را برای بررسیِ امنیت می‌سازد',
 'variant-analysis':'نمونه‌های مشابهِ یک ایراد یا آسیب‌پذیری را در کد پیدا می‌کند',
 'vulnerability-triage-brocards':'گزارش‌های آسیب‌پذیری را با قواعد مشخص برای بررسیِ بیشتر اولویت‌بندی می‌کند'
};
const skills = {
 'office':'ساخت و بررسیِ فایل‌های Office و PDF و ابزارهای تبدیل و محاسبه را آماده می‌کند',
 'office-docx':'فایل Word را می‌خواند، می‌سازد، ویرایش و بررسی می‌کند',
 'office-pptx':'اسلایدهای PowerPoint را می‌خواند، می‌سازد، ویرایش و بررسی می‌کند',
 'office-xlsx':'فایل Excel، داده‌ها و فرمول‌هایش را می‌خواند، می‌سازد و بررسی می‌کند',
 'official-plugins':'برای قابلیتِ درخواستی، افزونهٔ رسمیِ مناسب و کارتِ فعال‌سازی پیشنهاد می‌دهد',
 'personalized-pages':'برای صفحه یا ابزارِ شخصی، طرح و کارتِ ساخت پیشنهاد می‌دهد؛ ساخت با کلیکِ حبیب شروع می‌شود',
'airdrop-telegram-tracker':'پیام‌های صادرشدهٔ کانال‌های Telegram را به گزارشِ فارسیِ ایردراپ تبدیل می‌کند',
 'computer-use':'با برنامه‌های کامپیوتر از راهِ دیدن و کنترلِ رابط کار می‌کند',
 'deep-research':'موضوع را از چند منبع تحقیق و مقایسه می‌کند',
 'ghadam-be-ghadam':'کار را قدم‌به‌قدم همراهِ حبیب پیش می‌برد',
 'moment':'لحظهٔ فهمیدنِ یک بحث را به سندِ قابل برگشت تبدیل می‌کند',
 'bale-pol':'رباتِ بله را برای رفت‌وبرگشتِ پیام و ویس با ایجنت راه می‌اندازد',
 'boardsaz':'تعریف‌ها، شرطِ باطل و بوردِ دیدنیِ تصمیم‌های چت را به هم وصل می‌کند',
 'browser':'روشِ استفاده از Chrome و Brave حبیب را مشخص می‌کند',
 'browser-project':'تجربه‌ها و روشِ کارِ همین پروژه با مرورگر را می‌خواند',
 'chatbrain':'بورد، کارت و ارتباط‌ها را در Chat Brain مدیریت می‌کند',
 'divar':'آگهی‌های دیوار را برای پروژهٔ ۲۰۶ می‌خواند و طبق دستور با آگهی‌دهنده ارتباط می‌گیرد',
 'git-release-workflow':'روالِ کامیت، نسخه، تگ و انتشارِ پروژه را انجام می‌دهد',
 'hafeze':'حرف‌ها و کارهای چت‌های قبلیِ حبیب را در حافظه جست‌وجو می‌کند',
 'metamask-agent-wallet':'کیف پول، موجودی و عملیاتِ بلاک‌چین را با ابزار MetaMask مدیریت می‌کند',
 'modiriat-project-omran':'مدت کار، نیروی انسانی، مزد و برنامهٔ پروژهٔ عمرانی را بررسی می‌کند',
 'nazer':'درخواست‌های جاافتاده، سوءبرداشت‌ها و کارهای بعدیِ چت را گزارش می‌دهد',
 'nazer-boot':'برای ادامهٔ چت‌های فعال، پیامِ کوتاهِ بیدارباش آماده می‌کند',
 'nazer-ideas':'بر پایهٔ درخواست‌های قبلی، ایده‌های بعدی را فهرست می‌کند',
 'nazer-ravesh':'روشِ واقعیِ انجامِ کار و درس‌های یک چت را مستند می‌کند',
 'nazer-report':'گزارشِ درخواست‌های انجام‌نشده و سوءبرداشت‌های چت را بی‌سؤال می‌دهد',
 'onchain-forensics':'ادعای مالی را تا داده و تراکنشِ واقعیِ روی زنجیره ردیابی می‌کند',
 'ravesh-adad-ghati':'عددِ حدسی را با منبعِ اصلی و آزمونِ قابل ردشدن بررسی می‌کند',
 'skill-finder':'برای نیازِ اعلام‌شده، اسکیل یا افزونهٔ موجود پیدا می‌کند',
 'watch':'ویدیو را با قاب‌ها و متنِ گفتار می‌خواند و بررسی می‌کند',
 'whatsapp':'پیام‌های واتساپ را جست‌وجو و طبق دستور پاسخ را آماده یا ارسال می‌کند'
};
const mcp = {'hafeze':'در حافظهٔ گفتگوهای قبلیِ حبیب جست‌وجو می‌کند',
 'computer_use':'از راهِ اتصالِ کامپیوتر، برنامه‌ها و صفحه را می‌خواند یا کنترل می‌کند — ساختِ Adam Jones · github.com/domdomegg/computer-use-mcp',
 'claude-vscode':'Claude را به قابلیت‌های محیطِ VS Code وصل می‌کند',
 'claude.ai Google Sheets':'با فایل‌های Google Sheets از راهِ حسابِ متصل کار می‌کند'};
function readJson(p){try{return JSON.parse(fs.readFileSync(p,
 'utf8'))}catch{return {}}}
function skillDescription(file){try{const t=fs.readFileSync(file,
 'utf8');const f=t.startsWith('---')?t.split('---')[1]:'';const m=f.match(/^description:\s*([^\n]*)(?:\n((?:[ \t]+[^\n]*\n?)*))?/m);if(!m)return '';return (m[1].match(/^[>|][-+]?$/)?m[2]||'':m[1]).trim().replace(/^['"]|['"]$/g,'').replace(/\s+/g,' ')}catch{return ''}}
const metadataCache=new Map();
function claudeMetadata(cwd,home=path.join(os.homedir(),'.claude')){
 const cacheKey=home+'\0'+cwd;const cached=metadataCache.get(cacheKey);if(cached&&Date.now()-cached.time<60000)return cached.result;
 const result={abzar:{},
 mcp:{},
 afzune:{},
 eskil:{}};
 const installed=readJson(path.join(home,
 'plugins/installed_plugins.json')).plugins||{};
 for(const [name,entries] of Object.entries(installed)){const e=entries.at(-1);if(!e?.installPath)continue;const file=path.join(e.installPath,'.claude-plugin/plugin.json');const d=readJson(file);result.afzune[name]={description:d.description||'',
 definitionSource:file,
 source:'claude'};}
 // Resolve synced plugin UUID directories by the name in their real manifest.
 const synced=path.join(home,'plugins/synced');
 let namespaces=[];try{namespaces=fs.readdirSync(synced)}catch{}
 for(const namespace of namespaces){let dirs=[];try{dirs=fs.readdirSync(path.join(synced,namespace))}catch{}for(const dir of dirs){const file=path.join(synced,namespace,dir,'.claude-plugin/plugin.json');const d=readJson(file);if(d.name&&d.description)result.afzune[d.name+'@synced']={description:d.description,definitionSource:file,source:'claude'};}}
 for(const dir of [path.join(home,
 'skills'),...(cwd?[path.join(cwd,'.claude/skills')]:[])]){let names=[];try{names=fs.readdirSync(dir)}catch{}for(const name of names){const file=path.join(dir,name,
 'SKILL.md');const description=skillDescription(file);if(description)result.eskil[name]={description,
 definitionSource:file,
 source:'claude'};}}
 metadataCache.set(cacheKey,{time:Date.now(),result});return result;
}
function resolveHelp(kind,name,meta={}){
 const canonical=meta.canonicalName||String(name).replace(/^mcp__[^]+?__(claude_|dsh_)/,'$1').replace(/^(claude_|dsh_)/,'');
 const key=canonical.startsWith('@')?canonical:canonical.split('@')[0]; const short=key.split(':').at(-1);
 const source=meta.source||(kind==='abzar_dsh'?'deepseek':'claude');
 const native=kind==='abzar'||kind==='abzar_dsh'||/^(claude_|dsh_)/.test(name)||!!meta.canonicalName;
 let usage=native?builtin[canonical]:kind==='afzune'?plugins[key]:kind==='eskil'?skills[short]:mcp[canonical];
 const description=String(meta.description||'').trim();
 const origin=source==='deepseek'?'DeepSeek Harness':source==='claude'?'Claude Code':String(source);
 let definitionSource=meta.definitionSource||(native?(source==='deepseek'?'تعریفِ نصب‌شدهٔ ابزار DeepSeek':'Doc/matn_abzarha_claude_code.md'):'تعریفِ نصب‌شدهٔ افزونه یا اسکیل');
 if(!usage){if(/[\u0600-\u06ff]/.test(description))usage=description;else usage=description?'توضیحِ فارسی هنوز آماده نیست؛ تعریفِ سازنده: '+description:'توضیحِ معتبرِ این مورد هنوز در دسترس نیست';}
 if(meta.status&&meta.status!=='available'&&meta.status!=='ready')usage+=' — '+(meta.reason||'فعلاً قابل اجرا نیست');
 else if(meta.requiresSession)usage+='؛ به چتِ مبدأ نیاز دارد';
 if(meta.requiresConsent)usage+='؛ به اجازه نیاز دارد';
 return {usage,origin,definitionSource,description};
}
function policyApi(){return require(process.env.CRTL_TOOL_POLICY_MODULE||'../dsh-claude-yeki/tools-policy.cjs');}
function aliasesFor(name){return policyApi().aliasesFor(name);}
function aliasOn(list,name,on=true){const aliases=aliasesFor(name);return !['mcp','abzar','abzar_dsh','afzune'].some(kind=>aliases.some(n=>list?.[kind]?.[n]===false))&&on;}
function mergeAliasLists(...lists){
 const out={};for(const list of lists)for(const kind of ['mcp','abzar','abzar_dsh','afzune'])out[kind]={...(out[kind]||{}),...(list?.[kind]||{})};return out;
}
function effectiveAliasPolicy(options={}){
 return mergeAliasLists(options.baseList,policyApi().effectiveTickList(options));
}
function importedTickOn(options={}){
 return aliasOn(options.list||effectiveAliasPolicy(options),options.name)&&policyApi().resolveTickState(options).allowed;
}
function updateDraftTickSnapshot(options){return policyApi().updateDraftTickSnapshot(options);}
function expandAliasChanges(changes,list,kinds=['mcp','abzar_dsh','abzar']){
 const expanded=new Map();
 for(const change of changes){
  expanded.set(change.kind+'\0'+change.name,change);
  if(change.kind!=='mcp'||!importedName(change.name))continue;
  const aliases=aliasesFor(change.name);
  for(const name of aliases)if(typeof list?.mcp?.[name]==='boolean')expanded.set('mcp\0'+name,{kind:'mcp',name,on:change.on});
  for(const kind of kinds)if(kind!=='mcp')for(const name of aliases)if(typeof list?.[kind]?.[name]==='boolean')expanded.set(kind+'\0'+name,{kind,name,on:change.on});
 }
 return [...expanded.values()];
}
const importedName = name => /^(?:claude_|dsh_|mcp__(?:claude_yeki|dsh_yeki)__)/.test(String(name));
const normalizedSession = id => String(id||'').replace(/^session-([0-9a-f-]{36})$/i,'$1').toLowerCase();
function bridgeRows(home=os.homedir(),cwd='',sessionId=''){
 if(!cwd||!sessionId)return [];
 let folder;try{folder=fs.realpathSync(cwd)}catch{return []}
 const rows=readJson(path.join(home,'.dsh/dsh-rtl/bridge-inventory.json'));
 return Array.isArray(rows)?rows.filter(r=>r?.scope?.cwd===folder&&normalizedSession(r.scope.sessionId)===normalizedSession(sessionId)):[];
}
function enrichClaude(data){
 const base=claudeMetadata(data.cwd);
 const meta={...base,mcp:{...base.mcp}};
 const imported=bridgeRows(data.home||os.homedir(),data.cwd,data.scopeSessionId||data.chat||data.sid).filter(r=>r.source==='deepseek');
 const allowed=new Set(imported.map(r=>r.name));
 const aliasPolicy=effectiveAliasPolicy({home:data.home||os.homedir(),cwd:data.cwd,sessionId:data.scopeSessionId||data.chat||data.sid,scope:data.viewScope||'chat',baseList:data.aliasList||Object.fromEntries(Object.entries(data.ghalam||{}).map(([kind,rows])=>[kind,Object.fromEntries(rows.map(r=>[r.n,r.on]))]))});
 for(const r of imported)meta.mcp[r.name]=r;
 for(const [kind,rows] of Object.entries(data.ghalam||{})){
  data.ghalam[kind]=rows.filter(r=>!importedName(r.n)||(kind==='mcp'&&allowed.has(r.n)));
  for(const r of data.ghalam[kind]){if(importedName(r.n))r.on=importedTickOn({home:data.home||os.homedir(),cwd:data.cwd,sessionId:data.scopeSessionId||data.chat||data.sid,scope:data.viewScope||'chat',name:r.n,source:meta.mcp[r.n]?.source||'deepseek',list:aliasPolicy});Object.assign(r,resolveHelp(kind,r.n,{...(meta[kind]?.[r.n]||{}),...r}));}
 }
 return data;
}
module.exports={resolveHelp,claudeMetadata,enrichClaude,bridgeRows,importedName,aliasesFor,aliasOn,expandAliasChanges,effectiveAliasPolicy,importedTickOn,updateDraftTickSnapshot};
if(require.main===module){let raw='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>raw+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(enrichClaude(JSON.parse(raw)))));}
