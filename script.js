function openApp() {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.expand();
    }

    alert("Mini App Opened! Replace this with real features.");
}
