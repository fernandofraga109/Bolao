import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary raiz do app.
 *
 * Sem isto, qualquer exceção não capturada durante o render/commit derruba
 * toda a árvore React e deixa apenas o fundo azul escuro (ex.: o crash de
 * QuotaExceededError do localStorage no iOS). Aqui exibimos uma tela amigável
 * com opções de recuperação — incluindo limpar o cache local, que resolve o
 * caso de cota de armazenamento cheia.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Erro não capturado:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearAndReload = (): void => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("bolao_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignorar erros de localStorage */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#0f172a",
          color: "#f1f5f9",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "20px",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            marginBottom: "24px",
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: 800,
            marginBottom: "8px",
            letterSpacing: "-0.02em",
          }}
        >
          Ops! Algo deu errado
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "#94a3b8",
            maxWidth: "360px",
            lineHeight: 1.5,
            marginBottom: "28px",
          }}
        >
          O aplicativo encontrou um problema inesperado. Tente recarregar. Se o
          erro continuar, limpe os dados locais e entre novamente.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
            maxWidth: "280px",
          }}
        >
          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: "#10b981",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: "14px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>

          <button
            onClick={this.handleClearAndReload}
            style={{
              backgroundColor: "transparent",
              color: "#94a3b8",
              fontWeight: 600,
              fontSize: "13px",
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid #334155",
              cursor: "pointer",
            }}
          >
            Limpar dados e recarregar
          </button>
        </div>

        {this.state.error?.message && (
          <pre
            style={{
              marginTop: "28px",
              fontSize: "11px",
              color: "#475569",
              fontFamily: "monospace",
              maxWidth: "320px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
