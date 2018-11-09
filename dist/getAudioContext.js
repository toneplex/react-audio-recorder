var ac = null;
if (window['AudioContext'] || window['webkitAudioContext']) {
    ac = new (window["AudioContext"] || window["webkitAudioContext"])();
}
export default ac;
