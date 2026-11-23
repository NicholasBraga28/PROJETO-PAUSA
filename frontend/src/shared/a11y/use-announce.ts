import { useContext } from "react";
import { AnnouncerContext } from "./Announcer";

export const useAnnounce = () => useContext(AnnouncerContext);
