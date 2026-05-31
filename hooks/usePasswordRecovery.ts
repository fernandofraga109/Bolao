import { useState, useEffect } from "react";
import { User } from "../types";

export const usePasswordRecovery = (currentUser: User | null) => {
  const isRecoveryLink = () => {
    if (typeof window === "undefined") return false;

    const url = new URL(window.location.href);

    // Verificar URL params para modo de recovery explícito (fallback)
    if (url.searchParams.get("mode") === "recovery") {
      return true;
    }

    // Verificar hash params (do redirect do Supabase)
    const hashParams = new URLSearchParams(
      window.location.hash.replace("#", ""),
    );
    const hashType = (hashParams.get("type") || "").toLowerCase();
    const hasAccessToken = !!hashParams.get("access_token");

    // Se hash tem type=recovery E access_token, é uma sessão válida de recovery
    return hashType === "recovery" && hasAccessToken;
  };

  const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState<boolean>(
    () => isRecoveryLink(),
  );

  useEffect(() => {
    const checkRecovery = () => {
      const isRecovery = isRecoveryLink();
      console.log(
        "[Recovery Flow] Detectado:",
        isRecovery,
        "Hash:",
        window.location.hash,
      );
      // Só altera para true, nunca volta para false automaticamente por aqui
      // para evitar que o Supabase limpando a URL resete o estado.
      if (isRecovery) {
        setIsPasswordRecoveryFlow(true);
      }
    };

    checkRecovery();

    window.addEventListener("hashchange", checkRecovery);
    window.addEventListener("popstate", checkRecovery);

    // Verificar novamente após delay para capturar redirects assincronos
    const timeout = setTimeout(checkRecovery, 500);

    return () => {
      window.removeEventListener("hashchange", checkRecovery);
      window.removeEventListener("popstate", checkRecovery);
      clearTimeout(timeout);
    };
  }, []);

  const finishPasswordRecoveryFlow = () => {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.delete("mode");
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}`,
    );
    setIsPasswordRecoveryFlow(false);
  };

  // Removido o auto-finish quando currentUser existe, 
  // pois o Supabase loga o usuário automaticamente ao clicar no link de recovery,
  // o que resetava o estado antes de mostrar a tela de nova senha.
  /*
  useEffect(() => {
    if (currentUser && isPasswordRecoveryFlow) {
      finishPasswordRecoveryFlow();
    }
  }, [currentUser, isPasswordRecoveryFlow]);
  */

  return {
    isPasswordRecoveryFlow,
    finishPasswordRecoveryFlow,
  };
};
