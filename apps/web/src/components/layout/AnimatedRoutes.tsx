import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTransition } from "@/components/layout/PageTransition";
import Landing from "@/pages/Landing";
import SystemStatus from "@/pages/SystemStatus";
import IdeaInbox from "@/pages/IdeaInbox";
import IdeaDetail from "@/pages/IdeaDetail";
import ActionQueue from "@/pages/ActionQueue";
import ResearchPackets from "@/pages/ResearchPackets";
import ResearchPacketDetail from "@/pages/ResearchPacketDetail";
import QAReport from "@/pages/QAReport";
import MemorySearch from "@/pages/MemorySearch";
import NotFound from "@/pages/NotFound";

export const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Landing page without layout */}
        <Route 
          path="/" 
          element={
            <PageTransition>
              <Landing />
            </PageTransition>
          } 
        />
        
        {/* App pages with layout */}
        <Route 
          path="/status" 
          element={
            <AppLayout>
              <PageTransition>
                <SystemStatus />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/inbox" 
          element={
            <AppLayout>
              <PageTransition>
                <IdeaInbox />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/inbox/:id" 
          element={
            <AppLayout>
              <PageTransition>
                <IdeaDetail />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/queue" 
          element={
            <AppLayout>
              <PageTransition>
                <ActionQueue />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/research" 
          element={
            <AppLayout>
              <PageTransition>
                <ResearchPackets />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/research/:id" 
          element={
            <AppLayout>
              <PageTransition>
                <ResearchPacketDetail />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/qa" 
          element={
            <AppLayout>
              <PageTransition>
                <QAReport />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="/memory" 
          element={
            <AppLayout>
              <PageTransition>
                <MemorySearch />
              </PageTransition>
            </AppLayout>
          } 
        />
        <Route 
          path="*" 
          element={
            <PageTransition>
              <NotFound />
            </PageTransition>
          } 
        />
      </Routes>
    </AnimatePresence>
  );
};
