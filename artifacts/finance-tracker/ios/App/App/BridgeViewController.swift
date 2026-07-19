import UIKit
import Capacitor

/// Subclass de CAPBridgeViewController — Android tiene el botón físico de
/// "atrás" y un overscroll con glow (no rebote); iOS no tiene ninguno de los
/// dos por default, así que la WKWebView se sentía como una página web suelta
/// que se arrastraba. Esto la fija a la app nativa y habilita el gesto
/// estándar de iOS para volver atrás (swipe desde el borde izquierdo).
class BridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.bounces = false
        webView?.allowsBackForwardNavigationGestures = true
    }
}
