/* app.js — Bandas Salariales DC */

// Cerrar flash messages automáticamente después de 6 segundos
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.alert.alert-success').forEach(el => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
      bsAlert.close();
    }, 6000);
  });
});
