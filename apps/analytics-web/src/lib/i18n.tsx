'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'th' | 'en';

const LANG_KEY = 'analytics-lang';

function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'th';
  return (localStorage.getItem(LANG_KEY) as Lang) || 'th';
}

/** Module-level mirror so the axios interceptor (outside React) can read the
 * current language without a hook. Kept in sync by LangProvider. */
export let currentLang: Lang = 'th';

type Entry = { th: string; en: string };

// Flat, dot-namespaced dictionary. Add keys here as more screens are localized.
const DICT: Record<string, Entry> = {
  // Sidebar chrome
  'shell.viewingStore': { th: 'กำลังดูสาขา', en: 'Viewing store' },
  'shell.connecting': { th: 'กำลังเชื่อมต่อ…', en: 'Connecting…' },
  'shell.loadingStore': { th: 'กำลังโหลดข้อมูลร้าน…', en: 'Loading store data…' },
  'shell.connected': { th: 'เชื่อมต่อแล้ว', en: 'Connected' },
  'shell.offline': { th: 'บริการขัดข้อง', en: 'Service offline' },
  'shell.offlineHint': { th: 'analytics-api ไม่ตอบสนอง — รัน:', en: 'analytics-api not responding — run:' },
  'shell.ordersDays': { th: 'ออเดอร์ · 30 วัน', en: 'orders · 30 days' },
  'shell.noOrders': { th: 'ยังไม่มีข้อมูลออเดอร์ — รัน', en: 'No order data yet — run' },
  'shell.inApiDir': { th: 'ใน apps/api', en: 'in apps/api' },
  'shell.storeLabel': { th: 'สาขา', en: 'Store' },
  'shell.home': { th: 'หน้าหลัก', en: 'Home' },
  'shell.backToPos': { th: 'กลับไป POS', en: 'Back to POS' },
  'shell.group.now': { th: "วันนี้เป็นไง", en: "How's today" },
  'shell.group.analyze': { th: 'วิเคราะห์เชิงลึก', en: 'Deep analysis' },
  'shell.group.helper': { th: 'ผู้ช่วย', en: 'Assistant' },
  'nav.overview': { th: 'ภาพรวม', en: 'Overview' },
  'nav.playbook': { th: 'สิ่งที่ต้องทำวันนี้', en: 'To-do today' },
  'nav.customers': { th: 'ลูกค้า', en: 'Customers' },
  'nav.menu': { th: 'เมนูขายดี/แย่', en: 'Menu performance' },
  'nav.promotions': { th: 'โปรโมชัน', en: 'Promotions' },
  'nav.assistant': { th: 'ถาม AI', en: 'Ask AI' },

  // Overview page
  'ov.title': { th: 'ภาพรวม', en: 'Overview' },
  'ov.subtitle': { th: 'สรุปวันนี้ + 30 วันล่าสุด + พยากรณ์ล่วงหน้า', en: "Today's snapshot + last 30 days + forecast ahead" },
  'ov.askAi': { th: 'ถาม AI', en: 'Ask AI' },
  'ov.realtime': { th: 'เรียลไทม์', en: 'Real-time' },
  'ov.updatesEveryMinute': { th: 'อัปเดตทุกนาที', en: 'Updates every minute' },
  'ov.revenueToday': { th: 'รายได้วันนี้', en: 'Revenue today' },
  'ov.ordersToday': { th: 'ออเดอร์วันนี้', en: 'Orders today' },
  'ov.avgBill': { th: 'เฉลี่ย/บิล', en: 'Avg / bill' },
  'ov.vsYesterday': { th: 'เทียบเมื่อวาน', en: 'vs yesterday' },
  'ov.orders': { th: 'ออเดอร์', en: 'orders' },
  'ov.last30days': { th: '30 วันล่าสุด', en: 'Last 30 days' },
  'ov.totalRevenue': { th: 'รายได้รวม', en: 'Total revenue' },
  'ov.grossProfit': { th: 'กำไรขั้นต้น', en: 'Gross profit' },
  'ov.avgPerBill': { th: 'เฉลี่ยต่อบิล', en: 'Avg per bill' },
  'ov.vsPreviousPeriod': { th: 'เทียบช่วงก่อนหน้า', en: 'vs previous period' },
  'ov.revenueTrend': { th: 'แนวโน้มรายได้', en: 'Revenue trend' },
  'ov.topProducts': { th: 'สินค้าขายดี', en: 'Top products' },
  'ov.goalTitle': { th: 'เป้าหมายเดือนนี้', en: "This month's goal" },
  'ov.achieved': { th: 'ทำได้แล้ว', en: 'Achieved' },
  'ov.target': { th: 'เป้าหมาย', en: 'Target' },
  'ov.neededPerDay': { th: 'ต้องทำ/วัน', en: 'Needed / day' },
  'ov.projected': { th: 'คาดว่าจะได้', en: 'Projected' },
  'ov.forecastRevenue30': { th: 'พยากรณ์รายได้ (30 วันข้างหน้า)', en: 'Forecast revenue (next 30 days)' },
  'ov.historyUsed': { th: 'ข้อมูลย้อนหลังที่ใช้', en: 'History used' },
  'ov.tooLittle': { th: 'น้อยเกินไป — อาจไม่แม่นยำ', en: 'Too little — may be inaccurate' },
  'ov.decent': { th: 'พอใช้ได้', en: 'Decent' },
  'ov.enoughData': { th: 'ข้อมูลเพียงพอ', en: 'Enough data' },
  'ov.busiestHours': { th: 'ช่วงเวลาขายดีที่สุด', en: 'Busiest hours' },
  'ov.ordersTotal': { th: 'ออเดอร์รวม', en: 'orders total' },
  'ov.days': { th: 'วัน', en: 'days' },
  'ov.aiInsights': { th: 'AI Insights ล่าสุด', en: 'Recent AI insights' },
  'ov.regenerate': { th: 'วิเคราะห์ใหม่', en: 'Refresh analysis' },
  'ov.heatmapTitle': { th: 'ช่วงเวลาขายดี (วัน × ชั่วโมง)', en: 'Sales heatmap (day × hour)' },
  'ov.criticalStock': { th: 'สต็อกวิกฤต', en: 'Critical stock' },
  'ov.itemsRunOut': { th: 'รายการจะหมดภายใน 7 วัน —', en: 'item(s) will run out within 7 days —' },
  'ov.askAiReorder': { th: 'ถาม AI ว่าควรสั่งอะไร', en: 'ask AI what to reorder' },
  'ov.daysIn': { th: 'วันแล้ว', en: 'days in' },
  'ov.daysLeft': { th: 'วันที่เหลือ', en: 'left' },

  // Forecast section (folded into Overview)
  'fc.perDaySuffix': { th: '/วัน', en: '/day' },
  'fc.sectionTitle': { th: 'พยากรณ์รายได้ — 30 วันข้างหน้า', en: 'Revenue forecast — next 30 days' },
  'fc.legendNote': { th: 'เส้นทึบ = ข้อมูลจริง · เส้นประสีส้ม = พยากรณ์', en: 'Solid line = actual · orange dashed = forecast' },
  'fc.legendForecast': { th: 'พยากรณ์', en: 'Forecast' },
  'fc.legendBand': { th: 'ช่วงความเชื่อมั่น', en: 'Confidence band' },
  'fc.notEnoughData': { th: 'ข้อมูลยังไม่พอสำหรับพยากรณ์', en: 'Not enough data to forecast yet' },
  'fc.needAtLeastPrefix': { th: 'ต้องมีข้อมูลออเดอร์อย่างน้อย 7-14 วัน ตอนนี้มี', en: 'Need at least 7–14 days of orders; currently' },
  'fc.historyLabel': { th: 'ข้อมูลย้อนหลัง', en: 'history' },
  'fc.forecastLabel': { th: 'พยากรณ์', en: 'forecast' },
  'fc.today': { th: 'วันนี้', en: 'Today' },

  // Insights panel (folded into Overview)
  'ins.autoInsights': { th: 'อินไซต์อัตโนมัติ', en: 'Auto insights' },
  'ins.reanalyze': { th: 'วิเคราะห์ใหม่', en: 'Re-analyze' },
  'ins.noInsightsPrefix': { th: 'ยังไม่มีอินไซต์ — กด ', en: 'No insights yet — tap ' },
  'ins.noInsightsSuffix': {
    th: ' เพื่อให้ AI สรุปประเด็นสำคัญและสิ่งที่ควรจับตา',
    en: ' to have AI summarize the highlights and things to watch',
  },

  // Charts
  'chart.peakHours': { th: 'ช่วงเวลาขายดี', en: 'Peak hours' },
  'chart.revenueLabel': { th: 'รายได้', en: 'Revenue' },
  'chart.ordersWord': { th: 'ออเดอร์', en: 'orders' },

  // Playbook page
  'pb.title': { th: 'สิ่งที่ต้องทำวันนี้', en: 'To-do today' },
  'pb.subtitle': {
    th: 'AI รวบรวมทุกอย่างที่คุณควรจัดการวันนี้ — สต็อก ลูกค้า โปรโมชัน ครัว ไว้ที่เดียว',
    en: 'AI gathers everything you should handle today — stock, customers, promotions, kitchen — in one place',
  },
  'pb.whatToActOn': { th: 'สิ่งที่ต้องลงมือทำ', en: 'WHAT YOU CAN ACT ON' },
  'pb.bulletHigh': { th: 'จัดการรายการสีแดง (ด่วน) ก่อน — ทำตอนนี้เลย', en: 'Handle the red (urgent) items first — do these now' },
  'pb.bulletMedium': { th: 'รายการสีเหลือง — ทำระหว่างวันได้', en: 'Yellow items — do them sometime today' },
  'pb.bulletLow': { th: 'รายการทั่วไป — เก็บไว้ทำตอนมีเวลา', en: 'Regular items — keep for when you have time' },
  'pb.updateHint': { th: 'อัปเดตทุก 5 นาที — ทำเสร็จแล้วกด Refresh เพื่อดูรายการใหม่', en: "Updates every 5 minutes — finished one? hit Refresh to see the new list" },
  'pb.refresh': { th: 'รีเฟรช', en: 'Refresh' },
  'pb.urgent': { th: 'ด่วน', en: 'Urgent' },
  'pb.general': { th: 'ทั่วไป', en: 'General' },
  'pb.items': { th: 'รายการ', en: 'items' },
  'pb.do': { th: 'ทำ', en: 'DO' },
  'pb.priority.high': { th: 'ด่วน', en: 'Urgent' },
  'pb.priority.medium': { th: 'ปานกลาง', en: 'Medium' },
  'pb.priority.low': { th: 'ทั่วไป', en: 'General' },
  'pb.empty': { th: 'วันนี้ไม่มีรายการที่ต้องทำเป็นพิเศษ 🎉', en: 'Nothing urgent to handle today 🎉' },
  'pb.cantConnect': { th: 'เชื่อมต่อบริการ Analytics ไม่ได้', en: "Can't connect to the Analytics service" },
  'pb.startAnalyticsApi': { th: 'ให้เปิด analytics-api ที่พอร์ต 8000 ก่อน', en: 'Start analytics-api on port 8000 first' },
  'pb.allClear': { th: 'เคลียร์แล้ว — ไม่มีอะไรต้องทำ', en: 'All clear — nothing to do' },
  'pb.allDone': { th: 'เสร็จหมดแล้ว', en: 'All done' },
  'pb.checkBackLater': { th: 'ตอนนี้ไม่มีอะไรต้องทำ — กลับมาดูใหม่ทีหลัง', en: 'Nothing to do right now — check back later' },

  // Customers page
  'cust.title': { th: 'ลูกค้า', en: 'Customers' },
  'cust.subtitle': {
    th: 'จัดกลุ่มลูกค้าอัตโนมัติจาก 3 สัญญาณ: มาบ่อยแค่ไหน ใช้จ่ายเท่าไหร่ และซื้อล่าสุดเมื่อไหร่ (RFM)',
    en: 'Auto-groups customers from 3 signals: how often they visit, how much they spend, and how recently they bought (RFM)',
  },
  'cust.howTo1': { th: 'ดู "สิ่งที่ควรทำต่อไป" ในกล่องสีเหลืองด้านล่าง — บอกว่าควรโฟกัสใครก่อน', en: 'Check "What to do next" in the yellow box below — it tells you who to focus on first' },
  'cust.howTo2': { th: 'กดที่กลุ่ม → ดูรายชื่อ + คัดลอกข้อความ SMS / Export CSV เพื่อทำแคมเปญ', en: 'Click a group → see the list + copy an SMS message / Export CSV for a campaign' },
  'cust.howTo3': { th: 'โฟกัส "กำลังจะหาย" + "หายไปนาน" — ได้ผลตอบแทนสูงสุดเพราะรู้จักร้านเราอยู่แล้ว', en: 'Focus on "At risk" + "Long gone" — highest ROI since they already know your store' },
  'cust.tip': { th: 'เคล็ดลับ: ส่งแคมเปญ SMS ทุก 2 สัปดาห์สำหรับกลุ่มกำลังจะหาย', en: 'Tip: run an SMS campaign every 2 weeks for the At-risk group' },
  'cust.cantConnect': { th: 'เชื่อมต่อบริการ Analytics ไม่ได้', en: "Can't connect to the Analytics service" },
  'cust.runCmd': { th: 'รัน', en: 'Run' },
  'cust.slippingAway': { th: 'ลูกค้ากำลังจะหาย', en: 'customers are slipping away' },
  'cust.slippingDesc1': { th: 'ลูกค้าในกลุ่ม', en: 'Customers in' },
  'cust.slippingDesc2': { th: 'ที่ไม่กลับมาซื้อเกิน 3 เดือน —', en: "who haven't returned in 3+ months —" },
  'cust.slippingDesc3': {
    th: 'ส่งคูปอง SMS ตอนนี้ อาจได้กลับมา 15-25% (เทียบกับลูกค้าใหม่ที่ ~2%)',
    en: 'send an SMS coupon now and 15–25% may come back (vs ~2% for new customers).',
  },
  'cust.atRiskLongGone': { th: 'กำลังจะหาย + หายไปนาน', en: 'At risk + Long gone' },
  'cust.customersLabel': { th: 'ลูกค้า', en: 'Customers' },
  'cust.viewAtRiskList': { th: 'ดูรายชื่อกำลังจะหาย', en: 'View At-risk list' },
  'cust.copySmsMessage': { th: 'คัดลอกข้อความ SMS', en: 'Copy SMS message' },
  'cust.totalCustomers': { th: 'ลูกค้าทั้งหมด', en: 'Total customers' },
  'cust.avgSpend': { th: 'ใช้จ่ายเฉลี่ย/คน', en: 'Avg spend / customer' },
  'cust.vip': { th: 'VIP', en: 'VIP' },
  'cust.atRisk': { th: 'กำลังจะหาย', en: 'At risk' },
  'cust.pickGroup': { th: 'เลือกกลุ่มเพื่อดูรายชื่อ', en: 'Pick a group to see the list' },
  'cust.clearFilter': { th: 'ล้างตัวกรอง', en: 'Clear filter' },
  'cust.all': { th: 'ทั้งหมด', en: 'All' },
  'cust.allGroups': { th: 'ลูกค้าทุกกลุ่ม', en: 'All customer groups' },
  'cust.whatToDo': { th: 'สิ่งที่ควรทำกับกลุ่มนี้', en: 'What to do with this group' },
  'cust.sampleSms': { th: 'ตัวอย่างข้อความ SMS', en: 'Sample SMS message' },
  'cust.copy': { th: 'คัดลอก', en: 'Copy' },
  'cust.copied': { th: 'คัดลอกแล้ว', en: 'Copied' },
  'cust.replaceHint': { th: "แทนที่ {name} ด้วยชื่อลูกค้า · {store} ด้วยชื่อร้านของคุณ", en: "Replace {name} with the customer's name · {store} with your store name" },
  'cust.customerList': { th: 'รายชื่อลูกค้า', en: 'Customer list' },
  'cust.people': { th: 'คน', en: 'people' },
  'cust.copyAllPhones': { th: 'คัดลอกเบอร์ทั้งหมด', en: 'Copy all phone numbers' },
  'cust.exportCsv': { th: 'ส่งออก CSV', en: 'Export CSV' },
  'cust.colName': { th: 'ชื่อ', en: 'Name' },
  'cust.colGroup': { th: 'กลุ่ม', en: 'Group' },
  'cust.colVisits': { th: 'จำนวนครั้ง', en: 'Visits' },
  'cust.colTotalSpent': { th: 'ยอดใช้จ่ายรวม', en: 'Total spent' },
  'cust.colLastVisit': { th: 'มาล่าสุด', en: 'Last visit' },
  'cust.colPoints': { th: 'แต้ม', en: 'Points' },
  'cust.daysAgo': { th: 'วันที่แล้ว', en: 'days ago' },
  'cust.never': { th: 'ไม่เคย', en: 'Never' },
  'cust.showingOf': { th: 'แสดง 200 จาก', en: 'Showing 200 of' },
  'cust.useExport': { th: '— ใช้ Export CSV เพื่อดูทั้งหมด', en: '— use Export CSV to see all' },
  'cust.toastExported': { th: 'ส่งออกลูกค้า', en: 'Exported' },
  'cust.toastExportedSuffix': { th: 'คนแล้ว', en: 'customers' },
  'cust.toastSmsCopied': { th: 'คัดลอกข้อความ SMS แล้ว', en: 'SMS message copied' },
  'cust.toastPhonesCopied': { th: 'คัดลอกแล้ว', en: 'Copied' },
  'cust.toastPhonesCopiedSuffix': { th: 'เบอร์โทร', en: 'phone numbers' },

  // Customer segment translations
  'seg.Champion.label': { th: 'ลูกค้า VIP', en: 'VIP customers' },
  'seg.Champion.desc': { th: 'มาบ่อย ใช้จ่ายเยอะ เพิ่งซื้อล่าสุด', en: 'Visit often, spend a lot, bought recently' },
  'seg.Champion.playbook': {
    th: 'ขอบคุณเป็นการส่วนตัว + ให้สิทธิ์ก่อนใครสำหรับโปรใหม่ + ของขวัญพิเศษ — รักษาไว้ในระยะยาว',
    en: 'Thank them personally + early access to new promos + special gifts — keep them around for the long run',
  },
  'seg.Champion.sms': {
    th: 'ขอบคุณคุณ{name}ที่สนับสนุน{store}เสมอมาค่ะ/ครับ 🙏 รับส่วนลดพิเศษ 15% สำหรับวันเกิดของคุณ เพียงแสดง SMS นี้',
    en: 'Thank you {name} for always supporting {store} 🙏 Enjoy a special 15% off for your birthday — just show this SMS',
  },
  'seg.Loyal.label': { th: 'ลูกค้าประจำ', en: 'Regulars' },
  'seg.Loyal.desc': { th: 'กลับมาซื้อสม่ำเสมอ ผูกพันกับร้าน', en: 'Come back regularly, attached to the store' },
  'seg.Loyal.playbook': {
    th: 'ส่งโปรโมชันพิเศษ + ขอรีวิว/แนะนำเพื่อน + ชวนเข้าร่วมสะสมแต้ม',
    en: 'Send special promos + ask for reviews/referrals + invite to the loyalty program',
  },
  'seg.Loyal.sms': {
    th: '🎉 ขอบคุณที่เป็นลูกค้าประจำ! รับฟรี [สินค้า] เมื่อซื้อครบ 200 บาท ภายในสิ้นเดือนนี้',
    en: '🎉 Thanks for being a regular! Get a free [item] when you spend ฿200, through the end of this month',
  },
  'seg.BigSpender.label': { th: 'ลูกค้าใช้จ่ายสูง', en: 'Big spenders' },
  'seg.BigSpender.desc': { th: 'ใช้จ่ายเยอะต่อครั้ง แต่อาจมาไม่บ่อย', en: 'Spend a lot per visit, but maybe not often' },
  'seg.BigSpender.playbook': {
    th: 'เสนอสินค้าพรีเมียม + ของแถมเมื่อสั่งเยอะ — กระตุ้นให้มาบ่อยขึ้น',
    en: 'Offer premium items + gifts for large orders — encourage more frequent visits',
  },
  'seg.BigSpender.sms': {
    th: 'จัดงาน/ปาร์ตี้อยู่ใช่ไหมคะ/ครับ? เรามีเซ็ตพิเศษสำหรับคุณ{name} — ลด 10% เมื่อสั่งเกิน 1,000 บาท',
    en: 'Hosting an event/party? We have a special set for you {name} — 10% off orders over ฿1,000',
  },
  'seg.New.label': { th: 'ลูกค้าใหม่', en: 'New customers' },
  'seg.New.desc': { th: 'เพิ่งซื้อครั้งแรก — ต้องดึงให้กลับมาอีก', en: 'Just bought for the first time — get them to return' },
  'seg.New.playbook': {
    th: 'ส่งคูปองสำหรับการมาครั้งที่ 2 ภายใน 7 วัน — เพิ่มอัตรากลับมาซื้อเป็น 30-40%',
    en: 'Send a 2nd-visit coupon within 7 days — boosts return rate to 30–40%',
  },
  'seg.New.sms': {
    th: 'ยินดีต้อนรับคุณ{name}! 🎁 รับส่วนลด 50 บาทสำหรับการมาครั้งถัดไป — ใช้ได้ภายใน 14 วัน',
    en: 'Welcome {name}! 🎁 ฿50 off your next visit — valid for 14 days',
  },
  'seg.Promising.label': { th: 'มีแนวโน้มดี', en: 'Promising' },
  'seg.Promising.desc': { th: 'มาแล้ว 2-3 ครั้ง เริ่มกลายเป็นลูกค้าประจำ', en: 'Visited 2–3 times, becoming a regular' },
  'seg.Promising.playbook': {
    th: 'ชวนสมัครสมาชิก + ส่งคำแนะนำที่ตรงกับพฤติกรรมการซื้อ',
    en: 'Invite them to sign up + send personalized recommendations',
  },
  'seg.Promising.sms': {
    th: 'สมัครสมาชิก{store}วันนี้ รับฟรี [สินค้า] + สะสมแต้ม: 1 บาท = 1 แต้ม',
    en: 'Join {store} today and get a free [item] + earn points: ฿1 = 1 point',
  },
  'seg.AtRisk.label': { th: 'กำลังจะหาย', en: 'At risk' },
  'seg.AtRisk.desc': { th: 'ไม่มา 3-6 เดือน — ต้องดึงกลับมาด่วน', en: "Haven't visited in 3–6 months — win them back fast" },
  'seg.AtRisk.playbook': {
    th: 'ส่งคูปองส่วนลดแรง ๆ (20-30%) เดี๋ยวนี้ — รอนานไปอาจไม่กลับมาแล้ว',
    en: 'Send a strong coupon (20–30% off) now — wait too long and they may not return',
  },
  'seg.AtRisk.sms': {
    th: 'คิดถึงคุณ{name}จัง! เราเก็บดีลพิเศษไว้ให้ — ลด 20% ครั้งถัดไป แสดง SMS นี้ที่ร้าน',
    en: 'We miss you {name}! We saved a special deal for you — 20% off next time, show this SMS in store',
  },
  'seg.Hibernating.label': { th: 'หายไปนาน', en: 'Long gone' },
  'seg.Hibernating.desc': { th: 'ไม่มา 6-12 เดือน — ลองส่งคูปองดึงกลับ', en: "Haven't visited in 6–12 months — try a win-back coupon" },
  'seg.Hibernating.playbook': {
    th: "แคมเปญดึงกลับ ลด 30-40% + ของแถม — ลองครั้งสุดท้าย ถ้าไม่กลับมาก็ตัดออกจากลิสต์",
    en: "Win-back campaign 30–40% off + a gift — last try; if they don't return, drop from the list",
  },
  'seg.Hibernating.sms': {
    th: 'คุณ{name} กลับมาเถอะนะ 💕 ลด 30% พิเศษเฉพาะคุณ ใช้ได้ครั้งเดียวภายใน 30 วัน',
    en: '{name}, come back 💕 30% off just for you, one-time use within 30 days',
  },
  'seg.Lost.label': { th: 'น่าจะเลิกซื้อแล้ว', en: 'Likely churned' },
  'seg.Lost.desc': { th: 'ไม่มาเกิน 1 ปี — จะรักษาไว้หรือปล่อยไป', en: 'No visit in over a year — keep or let go' },
  'seg.Lost.playbook': {
    th: 'งบจำกัด? ปล่อยไปก่อนได้ — เก็บไว้เฉพาะคนที่เคยใช้จ่ายเยอะ',
    en: 'On a tight budget? Drop them for now — keep only the ones who used to spend a lot',
  },
  'seg.NeverBought.label': { th: 'ยังไม่เคยซื้อ', en: 'Never purchased' },
  'seg.NeverBought.desc': { th: 'มีในระบบแต่ยังไม่เคยสั่งซื้อ', en: 'In the system but no orders' },
  'seg.NeverBought.playbook': {
    th: 'ส่งข้อเสนอแนะนำตัว + บอกว่าลูกค้าคนอื่นชอบอะไร',
    en: 'Send an intro offer + explain what other customers love',
  },

  // Menu page
  'menu.title': { th: 'เมนูไหนทำเงิน', en: 'Menu performance' },
  'menu.subtitle': {
    th: 'แบ่งสินค้าทุกตัวเป็น 4 กลุ่มตาม 2 แกน — ขายดีไหม และกำไรดีไหม — รู้ทันทีว่าควรทำยังไงกับแต่ละตัว',
    en: 'Splits every item into 4 groups by 2 axes — sells well or not, and high profit or not — so you instantly know what to do with each',
  },
  'menu.tip1': { th: 'อ่านกล่องคำแนะนำด้านบน — บอกว่าควรเริ่มจากตรงไหน', en: 'Read the tip box above — it tells you where to start' },
  'menu.tip2': { th: "เปิดกลุ่ม \"ขายดี แต่กำไรน้อย\" — ลองขึ้นราคา 5-10 บาทดู", en: 'Open the "Sells well, low margin" group — a 5–10฿ price bump usually works' },
  'menu.tip3': { th: 'กลุ่ม "มีศักยภาพ" → จัดโปรโมชันหรือดันเข้าเมนูหลัก', en: 'For the "Potential" group → run a promo or feature it on the menu' },
  'menu.tip4': { th: 'ส่งออก CSV ไปใช้ในที่ประชุมหรือแชร์ให้ทีมครัว', en: 'Export CSV to bring to a meeting or share with the kitchen team' },
  'menu.footnote': { th: 'อิงยอดขาย 30 วันล่าสุด · ขายมากกว่า 2 ชิ้น = "ขายดี"', en: 'Based on the last 30 days of sales · items selling more than 2 units = "sells well"' },
  'menu.createPromo': { th: 'สร้างโปรโมชัน', en: 'Create promotion' },
  'menu.exportAll': { th: 'ส่งออกทั้งหมด', en: 'Export all' },
  'menu.cantConnect': { th: 'เชื่อมต่อบริการ Analytics ไม่ได้', en: "Can't connect to the Analytics service" },
  'menu.startAnalyticsApi': { th: 'ให้เปิด analytics-api ที่พอร์ต 8000 ก่อน', en: 'Start analytics-api on port 8000 first' },
  'menu.whatItTells': { th: 'ดูว่าเมนูไหนขายดี และเมนูไหนที่ทำเงินให้ร้านจริง ๆ', en: 'See which items sell well and which actually make money' },
  'menu.tipBase': { th: 'อิงยอดขาย 30 วันล่าสุด · ขายมากกว่า', en: 'Based on the last 30 days of sales · items selling more than' },
  'menu.tipSuffix': { th: 'ชิ้น = "ขายดี"', en: 'units = "sells well"' },
  'menu.items': { th: 'รายการ', en: 'items' },
  'menu.noItemsInGroup': { th: 'ไม่มีรายการในกลุ่มนี้', en: 'No items in this group' },
  'menu.sold': { th: 'ขายแล้ว', en: 'Sold' },
  'menu.marginSuffix': { th: '% กำไร', en: '% margin' },
  'menu.exportAllCsv': { th: 'ส่งออกทั้งหมดเป็น CSV', en: 'Export all to CSV' },
  'menu.extraRevenueMo': { th: 'รายได้เพิ่ม/เดือน', en: 'Extra revenue/mo' },
  'menu.plowBannerTitleSuffix': { th: 'รายการขายดีแต่กำไรน้อย', en: "items sell well but have low margin" },
  'menu.plowBannerDesc1': { th: 'ขึ้นราคา 5 บาทให้ 3 อันดับแรก (เริ่มจาก', en: 'Raising the price by 5฿ on the top 3 (starting with' },
  'menu.plowBannerDesc2': { th: ') อาจเพิ่มกำไรได้ประมาณ', en: ') could add about' },
  'menu.plowBannerDesc3': { th: '/เดือน โดยแทบไม่กระทบยอดขาย', en: '/month in profit with little impact on sales.' },
  'menu.dogBannerTitleSuffix': { th: 'รายการที่ไม่ทำกำไร', en: "items aren't making money" },
  'menu.dogBannerDesc': {
    th: 'ขายน้อย + กำไรน้อย — พิจารณาตัดออกหรือปรับโฉมใหม่ เพื่อลดความซับซ้อนในครัว',
    en: 'Low sales + low profit — consider removing or rebranding them to simplify the kitchen.',
  },
  'menu.puzzleBannerTitleSuffix': { th: 'รายการกำไรดีที่คนยังไม่ค่อยรู้จัก', en: 'high-profit items few people know about' },
  'menu.puzzleBannerDesc': {
    th: 'เอาขึ้นเมนูเด่น โพสต์โซเชียล เพิ่มในคอมโบ — กำไรต่อจานสูง แค่ต้องการให้คนเห็นมากขึ้น',
    en: 'Feature them on the menu, post on social, add to combos — high profit per plate, they just need visibility.',
  },
  'menu.balancedTitle': { th: 'เมนูของคุณสมดุลดี', en: 'Your menu is well balanced' },
  'menu.balancedDesc': {
    th: 'คุณมีทั้งเมนูขายดีและเมนูที่มีศักยภาพสูง — รักษาคุณภาพไว้และลองเทรนด์ใหม่ ๆ',
    en: 'You have both star items and high-potential ones — keep the quality up and explore new trends.',
  },

  'menu.q.Star.label': { th: 'ดาวเด่น', en: 'Stars' },
  'menu.q.Star.oneLine': { th: 'กำไรดี + ขายดี', en: 'High profit + sells well' },
  'menu.q.Star.action': {
    th: "เก็บไว้และโปรโมทเป็นเมนูซิกเนเจอร์ — ติดป้าย 'ยอดนิยม' / โพสต์รูปสวย ๆ ลงโซเชียล",
    en: 'Keep and promote as a signature — tag it "Popular" / post nice photos on social',
  },
  'menu.q.Star.actionVerb': { th: 'คงไว้', en: 'Keep' },

  'menu.q.Puzzle.label': { th: 'มีศักยภาพ', en: 'Potential' },
  'menu.q.Puzzle.oneLine': { th: 'กำไรดีแต่ขายน้อย', en: 'High profit but low sales' },
  'menu.q.Puzzle.action': {
    th: 'ดันให้คนรู้จักมากขึ้น — เอาขึ้นเมนูเด่น เพิ่มในคอมโบ ลดราคา 10% ช่วงแรก',
    en: 'Push awareness — feature it on the menu, add to combos, 10% off at first',
  },
  'menu.q.Puzzle.actionVerb': { th: 'โปรโมท', en: 'Promote' },

  'menu.q.Plowhorse.label': { th: 'ขายดีแต่กำไรน้อย', en: 'Sells well, low margin' },
  'menu.q.Plowhorse.oneLine': { th: 'ขายดี + กำไรต่อชิ้นน้อย', en: 'High sales + low per-unit profit' },
  'menu.q.Plowhorse.action': {
    th: 'ขึ้นราคา 5-10 บาท หรือลดต้นทุนวัตถุดิบ — ลูกค้าซื้ออยู่แล้ว ปรับนิดเดียวได้กำไรเพิ่มเยอะ',
    en: 'Raise price 5–10฿ or cut ingredient cost — customers already buy it, a small tweak adds a lot of profit',
  },
  'menu.q.Plowhorse.actionVerb': { th: 'ปรับราคา', en: 'Reprice' },

  'menu.q.Dog.label': { th: 'ควรพิจารณาตัด', en: 'Drop candidates' },
  'menu.q.Dog.oneLine': { th: 'ขายน้อย + กำไรน้อย', en: 'Low sales + low profit' },
  'menu.q.Dog.action': {
    th: 'พิจารณาตัดออก/ปรับโฉมใหม่ — ช่วยลดความซับซ้อนในครัวและลดของค้างสต็อก',
    en: 'Consider removing / rebranding — simplifies the kitchen and avoids expiring stock',
  },
  'menu.q.Dog.actionVerb': { th: 'พิจารณาตัด', en: 'Consider dropping' },
  'menu.why.toggle': { th: 'ทำไมถึงแนะนำ?', en: 'Why this recommendation?' },

  // Promotions page
  'promo.title': { th: 'ไอเดียโปรโมชัน', en: 'Promotion ideas' },
  'promo.subtitle': {
    th: 'AI ดูข้อมูลร้านคุณแล้วแนะนำโปรโมชันที่น่าจะได้ผล พร้อมเหตุผลและผลลัพธ์ที่คาดไว้',
    en: 'AI reviews your store data and suggests promotions likely to work — with the reasoning and expected impact',
  },
  'promo.tip1': { th: 'อ่านคำแนะนำ → กด "วิธีตั้งค่า" → คัดลอก JSON config', en: 'Read a suggestion → click "How to set it up" → copy the JSON config' },
  'promo.tip2': { th: 'ไปที่ POS ตั้งค่า → โปรโมชัน → สร้างโปรโมชันใหม่จากค่าที่คัดลอกมา', en: 'Go to POS Settings → Promotions → create a new promotion from the copied values' },
  'promo.tip3': { th: 'ลองทำทีละ 1-2 อัน แล้วเทียบยอดขายรายสัปดาห์', en: 'Try one or two at a time, then compare sales week-over-week' },
  'promo.footnote': { th: 'ใช้ข้อมูลขายจริงของคุณ — ยิ่งเก็บข้อมูลนานเท่าไหร่ คำแนะนำยิ่งแม่นขึ้น', en: 'Uses your real sales data — the longer you collect, the sharper the suggestions' },
  'promo.copyConfig': { th: 'คัดลอก config', en: 'Copy config' },
  'promo.howToSetUp': { th: 'วิธีตั้งค่า', en: 'How to set it up' },
  'promo.whyRecommended': { th: 'เหตุผลที่แนะนำ', en: 'WHY RECOMMENDED' },
  'promo.expectedImpact': { th: 'ผลลัพธ์ที่คาดไว้', en: 'EXPECTED IMPACT' },
  'promo.cantConnect': { th: 'เชื่อมต่อบริการ Analytics ไม่ได้', en: "Can't connect to the Analytics service" },
  'promo.startAnalyticsApi': { th: 'ให้เปิด analytics-api ที่พอร์ต 8000 ก่อน', en: 'Start analytics-api on port 8000 first' },
  'promo.whatItTellsShort': { th: 'AI ดูข้อมูลร้านคุณแล้วแนะนำโปรโมชันที่น่าจะได้ผล', en: 'AI reviews your store data and suggests promotions likely to work' },
  'promo.noSuggestionsYet': { th: 'ยังไม่มีคำแนะนำ', en: 'No suggestions yet' },
  'promo.noSuggestionsDesc': {
    th: 'ต้องมีข้อมูลยอดขายอย่างน้อย 2-4 สัปดาห์ เก็บข้อมูลต่อไป หรือกลับมาดูใหม่เมื่อร้านเปิดมาสักพัก',
    en: 'Needs at least 2–4 weeks of sales data. Keep collecting, or check back once the store has been running for a while.',
  },
  'promo.type.BUNDLE': { th: 'ชุด / คอมโบ', en: 'Bundle / Combo' },
  'promo.type.HAPPY_HOUR': { th: 'แฮปปี้อาวร์', en: 'Happy hour' },
  'promo.type.WINBACK': { th: 'ดึงลูกค้ากลับ', en: 'Win back customers' },
  'promo.type.PRICE_UP': { th: 'ขึ้นราคา', en: 'Price increase' },
  'promo.type.PROMOTE': { th: 'โปรโมทสินค้า', en: 'Promote item' },
  'promo.steps': { th: 'ขั้นตอน', en: 'Steps' },
  'promo.step1': { th: 'เปิด POS → ตั้งค่า → โปรโมชัน', en: 'Open POS → Settings → Promotions' },
  'promo.step2': { th: 'กด "เพิ่มโปรโมชัน"', en: 'Click "Add promotion"' },
  'promo.step3': { th: 'กรอกค่าด้านล่าง (คัดลอกแต่ละช่องจาก JSON)', en: 'Fill in the values below (copy each field from the JSON)' },
  'promo.step4': { th: 'บันทึก แล้วทดสอบที่หน้าจอ POS', en: 'Save, then test it on the POS screen' },
  'promo.valuesToEnter': { th: 'ค่าที่ต้องกรอก', en: 'Values to enter' },
  'promo.configCopied': { th: 'คัดลอก config แล้ว', en: 'Promotion config copied' },

  // Assistant page
  'ai.title': { th: 'ผู้ช่วย AI ของ POS', en: 'POS AI Assistant' },
  'ai.subtitle': { th: 'ข้อมูลเรียลไทม์จาก POS', en: 'Real-time data from POS' },
  'ai.todayStatus': { th: 'สถานะวันนี้', en: "Today's status" },
  'ai.refresh': { th: 'รีเฟรช', en: 'Refresh' },
  'ai.revenueToday': { th: 'รายได้วันนี้', en: 'Revenue today' },
  'ai.vsYesterday': { th: 'เทียบเมื่อวาน', en: 'vs yesterday' },
  'ai.orders': { th: 'ออเดอร์', en: 'Orders' },
  'ai.ordersUnit': { th: 'ออเดอร์', en: 'orders' },
  'ai.today': { th: 'วันนี้', en: 'today' },
  'ai.days30Revenue': { th: '30 วัน (รายได้)', en: '30 days (revenue)' },
  'ai.growth': { th: 'เติบโต', en: 'growth' },
  'ai.lowStock': { th: 'สต็อกใกล้หมด', en: 'Low stock' },
  'ai.items': { th: 'รายการ', en: 'items' },
  'ai.reorderNeeded': { th: 'ต้องสั่งเพิ่ม', en: 'reorder needed' },
  'ai.ok': { th: 'ปกติ', en: 'OK' },
  'ai.askAnything': { th: 'ถามอะไรก็ได้!', en: 'Ask anything!' },
  'ai.askAnythingDesc': { th: 'AI ดึงข้อมูล POS จริงมาวิเคราะห์ให้แบบเรียลไทม์', en: 'AI pulls live POS data and analyzes it for you in real time' },
  'ai.popularQuestions': { th: 'คำถามยอดนิยม', en: 'POPULAR QUESTIONS' },
  'ai.quick.todaySales': { th: 'ยอดขายวันนี้', en: "Today's sales" },
  'ai.quick.todaySalesQ': { th: 'วันนี้ยอดขายเป็นอย่างไร เทียบเมื่อวานด้วย', en: "How are today's sales? Compare with yesterday too." },
  'ai.quick.reorder': { th: 'ของที่ต้องสั่งเพิ่ม', en: 'What to reorder' },
  'ai.quick.reorderQ': { th: 'สินค้าไหนต้องสั่งด่วนวันนี้บ้าง', en: 'Which products do I urgently need to reorder today?' },
  'ai.quick.staffTasks': { th: 'งานพนักงาน', en: 'Staff tasks' },
  'ai.quick.staffTasksQ': { th: 'วันนี้พนักงานควรโฟกัสอะไรบ้าง', en: 'What should the staff focus on today?' },
  'ai.quick.analyze': { th: 'วิเคราะห์ร้าน', en: 'Analyze store' },
  'ai.quick.analyzeQ': { th: 'ช่วยวิเคราะห์ธุรกิจแล้วแนะนำสิ่งที่ควรปรับปรุง', en: 'Analyze my business and suggest what to improve.' },
  'ai.quick.forecast': { th: 'พยากรณ์', en: 'Forecast' },
  'ai.quick.forecastQ': { th: 'พยากรณ์รายได้เดือนหน้าให้หน่อย', en: "Forecast next month's revenue." },
  'ai.quick.peakHours': { th: 'ช่วงเวลาลูกค้าเยอะ', en: 'Peak hours' },
  'ai.quick.peakHoursQ': { th: 'ช่วงเวลาไหนที่ลูกค้าเยอะที่สุด', en: 'Which hours have the most customers?' },
  'ai.inputPlaceholder': { th: 'เช่น วันนี้ยอดขายเป็นไง? พนักงานควรทำอะไร?', en: 'e.g. How are sales today? What should staff do?' },
  'ai.send': { th: 'ส่ง', en: 'Send' },
  'ai.clearChat': { th: 'ล้างแชท', en: 'Clear chat' },
  'ai.errorMsg': { th: '⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ AI กรุณาลองใหม่อีกครั้ง', en: '⚠️ Something went wrong connecting to the AI. Please try again.' },
  'ai.moreQuestions': { th: 'คำถามเพิ่มเติม', en: 'MORE QUESTIONS' },
};

/** Hook returning a translator bound to the current language. */
export function useT() {
  const { lang } = useLang();
  return (key: string, fallback?: string) => DICT[key]?.[lang] ?? fallback ?? key;
}

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    const stored = readStoredLang();
    setLangState(stored);
    currentLang = stored;
    document.documentElement.lang = stored;
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    currentLang = l;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANG_KEY, l);
      document.documentElement.lang = l;
    }
  };

  const value = useMemo(
    () => ({ lang, setLang, toggle: () => setLang(lang === 'th' ? 'en' : 'th') }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
