export type Lang = 'en' | 'ar'

const en = {
  // Brand
  appTagline: 'Honest video reviews for UAE',

  // Common
  back: '← Back',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  error: 'Error',
  permissionNeeded: 'Permission needed',
  photoPermissionMsg: 'Please allow photo library access.',
  cameraPermissionMsg: 'Please allow camera access.',
  mediaPermissionMsg: 'Please allow media library access.',
  choosePhotoTitle: 'Profile photo',
  takePhoto: 'Take photo',
  chooseFromLibrary: 'Choose from library',

  // Phone screen
  welcomeHeading: 'Welcome to Reviewencer',
  welcomeSub: 'Enter your phone number to continue',
  sendOtp: 'Send OTP →',
  otpDisclaimer: "We'll send a one-time SMS code to verify your number.",
  selectCountry: 'Select country',
  invalidNumber: 'Invalid number',
  invalidNumberMsg: 'Please enter a valid phone number.',

  // Verify screen
  checkSms: 'Check your SMS',
  codeSentTo: 'We sent a 6-digit code to',
  verifyBtn: 'Verify →',
  verifying: 'Verifying…',
  resendCode: 'Resend code',
  wrongNumber: '← Wrong number?',
  incorrectCode: 'Incorrect code',
  incorrectCodeMsg: 'Please check the code and try again.',
  resendInPrefix: 'Resend in ',
  resendInSuffix: 's',

  // Onboarding – language step
  chooseLanguage: 'Choose your language',
  chooseLanguageSub: 'You can change this anytime in settings.',
  continueBtn: 'Continue →',

  // Onboarding – profile step
  setupProfile: 'Set up your profile',
  setupProfileSub: "You're almost in — just a few details.",
  fullName: 'Full name',
  namePlaceholder: 'Your name',
  username: 'Username',
  getStarted: 'Get started →',
  initials: 'Initials',
  avatar: 'Avatar',
  photo: 'Photo',
  nameRequired: 'Name required',
  nameRequiredMsg: 'Please enter your full name.',
  handleRequired: 'Handle required',
  handleRequiredMsg: 'Please choose a username.',
  handleTakenAlert: 'Handle taken',
  handleTakenMsg: 'Please choose a different username.',
  handleTakenPrefix: '@',
  handleTakenSuffix: ' is already taken',

  // Tabs
  tabFeed: 'Feed',
  tabSearch: 'Search',
  tabReview: 'Review',
  tabMe: 'Me',

  // Feed
  noReviews: 'No reviews yet',
  noReviewsSub: 'Be the first to post a video review!',

  // Me screen
  reviews: 'Reviews',
  views: 'Views',
  legit: 'Legit',
  myReviews: 'My Reviews',
  noMyReviews: 'No reviews yet',
  noMyReviewsSub: 'Tap Review to share your first one',
  pendingApproval: '⏳  Pending approval',
  settings: 'Settings',
  editProfile: 'Edit profile',
  language: 'App language',
  contentLanguage: 'Content language',
  contentLangBoth: 'Both',
  signOut: 'Sign out',
  menuEditCaption: '✏️  Edit caption',
  menuShare: '↗  Share',
  menuDelete: '🗑  Delete review',
  deleteReviewTitle: 'Delete review',
  deleteReviewMsg: 'This cannot be undone.',
  editCaptionTitle: 'Edit caption',
  captionPlaceholder: 'What did you think?',
  profileNotFound: 'Profile not found',

  // Edit profile
  editProfileTitle: 'Edit profile',
  saveChanges: 'Save changes',

  // Record tab (business search)
  shareAReview: 'Share a review',
  whichBusiness: 'Which business are you reviewing?',
  searchBusinessPlaceholder: 'Search e.g. Talabat, Uber, Salt...',
  noBusinessFound: 'No businesses found. Ask us to add it!',
  categoriesHint1: '🍽️ Restaurants · 💇 Salons · 🏨 Hotels',
  categoriesHint2: '🏋️ Gyms · 🏦 Banks · 🛵 Delivery apps',
  categoriesHint3: '🎢 Entertainment · 🛒 Shopping & more',

  // Review screen
  shareYourReview: 'Share your review',
  helpOthers: 'Help others make better choices',
  featuredOnFeed: 'Featured on feed',
  addVideoReview: 'Add a video review',
  tapToRecordOrUpload: 'Tap to record or upload',
  videoAdded: '✓ Video added',
  videoReady: 'Your video is ready',
  recordNow: 'Record now',
  upload: 'Upload',
  removeVideo: 'Remove video',
  writeInstead: 'Write instead',
  writingReview: 'Writing a review',
  optional: 'Optional',
  captionInputPlaceholder: 'What did you love or hate?',
  yourVerdictDivider: 'your verdict',
  pickVerdict: 'Pick one — required',
  yourVerdictLabel: 'Your verdict',
  pleasePickVerdict: 'Please pick your verdict first 👆',
  submitReview: 'Submit review',
  verdictLovedIt: 'Loved it',
  verdictOkay: "It's okay",
  verdictNope: 'Nope',
  backToFeed: 'Back to feed',
  skipSharing: 'Skip sharing',
  videoSubmitted: 'Video review submitted!',
  textSubmitted: 'Review submitted!',
  ratingSubmitted: 'Rating saved!',
  videoSubmittedSub: "Pending approval — we'll notify you when it's live.",
  textSubmittedSub: 'Your review will appear on the business page.',
  ratingSubmittedSub: 'Your rating helps build the AI summary for this business.',
  captionWhenSharing: 'Caption when sharing',
  shareYourReviewBtn: 'Share your review',
  viewYourReview: 'View your review →',

  // Submit screen (legacy)
  whichBusinessQ: 'Which business?',
  searchForPlace: "Search for the place you're reviewing",
  searchBusinessPlaceholder2: 'e.g. Talabat, Uber...',
  howWasIt: 'How was it?',
  addCaption: 'Add a caption (optional)',
  submitReviewBtn: 'Submit Review 🎬',
  missingInfo: 'Missing info',
  selectBusiness: 'Please select a business.',
  submittedTitle: 'Submitted! 🎉',
  submittedMsg: 'Your review is being reviewed and will be published shortly.',

  // Review detail
  writtenReview: '📝 Written review',
  aiSummary: 'AI Summary',
  aiLikes: '👍 LIKEs',
  aiNopes: '👎 NOPEs',
  shareThisReview: 'Share this review',
  reviewNotFound: 'Review not found',
  share: 'Share',

  // Review card
  more: 'More',
  trusted: '✓ Trusted',
  legitBtn: 'Legit',
  tierTopReviewer: 'Top Reviewer',
  tierReviewencer: 'Reviewencer',
  tierReviewer: 'Reviewer',
}

export type TKey = keyof typeof en

export const ar: Record<TKey, string> = {
  // Brand
  appTagline: 'مراجعات فيديو صادقة للإمارات',

  // Common
  back: 'رجوع ←',
  cancel: 'إلغاء',
  save: 'حفظ',
  delete: 'حذف',
  error: 'خطأ',
  permissionNeeded: 'إذن مطلوب',
  photoPermissionMsg: 'يرجى السماح بالوصول إلى مكتبة الصور.',
  cameraPermissionMsg: 'يرجى السماح بالوصول إلى الكاميرا.',
  mediaPermissionMsg: 'يرجى السماح بالوصول إلى مكتبة الوسائط.',
  choosePhotoTitle: 'صورة الملف الشخصي',
  takePhoto: 'التقط صورة',
  chooseFromLibrary: 'اختر من المكتبة',

  // Phone screen
  welcomeHeading: 'مرحباً بك في Reviewencer',
  welcomeSub: 'أدخل رقم هاتفك للمتابعة',
  sendOtp: 'إرسال الرمز ←',
  otpDisclaimer: 'سنرسل لك رمزاً لمرة واحدة عبر الرسائل لتأكيد رقمك.',
  selectCountry: 'اختر الدولة',
  invalidNumber: 'رقم غير صالح',
  invalidNumberMsg: 'يرجى إدخال رقم هاتف صالح.',

  // Verify screen
  checkSms: 'تحقق من رسائلك',
  codeSentTo: 'أرسلنا رمزاً مكوناً من 6 أرقام إلى',
  verifyBtn: 'تأكيد ←',
  verifying: 'جارٍ التأكيد…',
  resendCode: 'إعادة إرسال الرمز',
  wrongNumber: 'رقم خاطئ؟ ←',
  incorrectCode: 'رمز غير صحيح',
  incorrectCodeMsg: 'يرجى التحقق من الرمز والمحاولة مجدداً.',
  resendInPrefix: 'إعادة الإرسال خلال ',
  resendInSuffix: 'ث',

  // Onboarding – language step
  chooseLanguage: 'اختر لغتك',
  chooseLanguageSub: 'يمكنك تغييرها في أي وقت من الإعدادات.',
  continueBtn: 'متابعة ←',

  // Onboarding – profile step
  setupProfile: 'أعدّ ملفك الشخصي',
  setupProfileSub: 'أنت على وشك الدخول — بضعة تفاصيل فقط.',
  fullName: 'الاسم الكامل',
  namePlaceholder: 'اسمك',
  username: 'اسم المستخدم',
  getStarted: 'ابدأ ←',
  initials: 'الأحرف',
  avatar: 'صورة رمزية',
  photo: 'صورة',
  nameRequired: 'الاسم مطلوب',
  nameRequiredMsg: 'يرجى إدخال اسمك الكامل.',
  handleRequired: 'اسم المستخدم مطلوب',
  handleRequiredMsg: 'يرجى اختيار اسم مستخدم.',
  handleTakenAlert: 'اسم المستخدم محجوز',
  handleTakenMsg: 'يرجى اختيار اسم مستخدم مختلف.',
  handleTakenPrefix: '@',
  handleTakenSuffix: ' محجوز بالفعل',

  // Tabs
  tabFeed: 'الرئيسية',
  tabSearch: 'بحث',
  tabReview: 'مراجعة',
  tabMe: 'أنا',

  // Feed
  noReviews: 'لا توجد مراجعات بعد',
  noReviewsSub: 'كن أول من يشارك مراجعة فيديو!',

  // Me screen
  reviews: 'مراجعات',
  views: 'مشاهدات',
  legit: 'موثوق',
  myReviews: 'مراجعاتي',
  noMyReviews: 'لا توجد مراجعات بعد',
  noMyReviewsSub: 'اضغط مراجعة لمشاركة أولى مراجعاتك',
  pendingApproval: '⏳  في انتظار الموافقة',
  settings: 'الإعدادات',
  editProfile: 'تعديل الملف الشخصي',
  language: 'لغة التطبيق',
  contentLanguage: 'لغة المحتوى',
  contentLangBoth: 'الكل',
  signOut: 'تسجيل الخروج',
  menuEditCaption: '✏️  تعديل التعليق',
  menuShare: '↗  مشاركة',
  menuDelete: '🗑  حذف المراجعة',
  deleteReviewTitle: 'حذف المراجعة',
  deleteReviewMsg: 'لا يمكن التراجع عن هذا.',
  editCaptionTitle: 'تعديل التعليق',
  captionPlaceholder: 'ما رأيك؟',
  profileNotFound: 'لم يُعثر على الملف الشخصي',

  // Edit profile
  editProfileTitle: 'تعديل الملف الشخصي',
  saveChanges: 'حفظ التغييرات',

  // Record tab
  shareAReview: 'شارك مراجعة',
  whichBusiness: 'أي نشاط تجاري تراجع؟',
  searchBusinessPlaceholder: 'ابحث مثلاً Talabat، Uber، Salt...',
  noBusinessFound: 'لم يُعثر على نشاط تجاري. اطلب منا إضافته!',
  categoriesHint1: '🍽️ مطاعم · 💇 صالونات · 🏨 فنادق',
  categoriesHint2: '🏋️ أندية · 🏦 بنوك · 🛵 تطبيقات توصيل',
  categoriesHint3: '🎢 ترفيه · 🛒 تسوق والمزيد',

  // Review screen
  shareYourReview: 'شارك مراجعتك',
  helpOthers: 'ساعد الآخرين على اتخاذ قرارات أفضل',
  featuredOnFeed: 'مميز في الرئيسية',
  addVideoReview: 'أضف مراجعة فيديو',
  tapToRecordOrUpload: 'اضغط للتسجيل أو الرفع',
  videoAdded: '✓ تم إضافة الفيديو',
  videoReady: 'الفيديو جاهز',
  recordNow: 'سجّل الآن',
  upload: 'رفع',
  removeVideo: 'إزالة الفيديو',
  writeInstead: 'اكتب بدلاً من ذلك',
  writingReview: 'كتابة مراجعة',
  optional: 'اختياري',
  captionInputPlaceholder: 'ما الذي أحببته أو كرهته؟',
  yourVerdictDivider: 'حكمك',
  pickVerdict: 'اختر واحداً — مطلوب',
  yourVerdictLabel: 'حكمك',
  pleasePickVerdict: 'يرجى اختيار حكمك أولاً 👆',
  submitReview: 'إرسال المراجعة',
  verdictLovedIt: 'أحببته',
  verdictOkay: 'لا بأس',
  verdictNope: 'لا',
  backToFeed: 'العودة للرئيسية',
  skipSharing: 'تخطي المشاركة',
  videoSubmitted: 'تم إرسال مراجعة الفيديو!',
  textSubmitted: 'تم إرسال المراجعة!',
  ratingSubmitted: 'تم حفظ التقييم!',
  videoSubmittedSub: 'في انتظار الموافقة — سنُعلمك عند نشره.',
  textSubmittedSub: 'ستظهر مراجعتك على صفحة النشاط التجاري.',
  ratingSubmittedSub: 'تقييمك يساعد في بناء ملخص الذكاء الاصطناعي لهذا النشاط.',
  captionWhenSharing: 'التعليق عند المشاركة',
  shareYourReviewBtn: 'شارك مراجعتك',
  viewYourReview: 'عرض مراجعتك ←',

  // Submit screen (legacy)
  whichBusinessQ: 'أي نشاط تجاري؟',
  searchForPlace: 'ابحث عن المكان الذي تراجعه',
  searchBusinessPlaceholder2: 'مثلاً Talabat، Uber...',
  howWasIt: 'كيف كانت تجربتك؟',
  addCaption: 'أضف تعليقاً (اختياري)',
  submitReviewBtn: 'إرسال المراجعة 🎬',
  missingInfo: 'معلومات ناقصة',
  selectBusiness: 'يرجى اختيار نشاط تجاري.',
  submittedTitle: 'تم الإرسال! 🎉',
  submittedMsg: 'مراجعتك قيد المراجعة وستُنشر قريباً.',

  // Review detail
  writtenReview: '📝 مراجعة مكتوبة',
  aiSummary: 'ملخص الذكاء الاصطناعي',
  aiLikes: '👍 الإيجابيات',
  aiNopes: '👎 السلبيات',
  shareThisReview: 'شارك هذه المراجعة',
  reviewNotFound: 'لم تُعثر على المراجعة',
  share: 'مشاركة',

  // Review card
  more: 'المزيد',
  trusted: '✓ موثوق',
  legitBtn: 'موثوق',
  tierTopReviewer: 'مراجع مميز',
  tierReviewencer: 'ريفيوسنسر',
  tierReviewer: 'مراجع',
}

const strings: Record<Lang, Record<TKey, string>> = { en, ar }
export default strings
