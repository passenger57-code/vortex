import { createContext, useContext, useState } from "react";
import InfoModal from "../components/InfoModal.jsx";

const ModalContext = createContext(null);
export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }) {
  const [titleId, setTitleId] = useState(null);
  return (
    <ModalContext.Provider value={{ open: setTitleId, close: () => setTitleId(null) }}>
      {children}
      <InfoModal titleId={titleId} onClose={() => setTitleId(null)} />
    </ModalContext.Provider>
  );
}
