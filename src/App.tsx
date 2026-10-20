import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { LecturePoolDetail } from "./components/LecturePoolDetail";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const { courses, loadSampleData } = useAppStore();

  // 初回起動時、データが空の場合は自動でサンプルデータを投入
  useEffect(() => {
    if (courses.length === 0) {
      loadSampleData();
    }
  }, [courses.length, loadSampleData]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      <Sidebar />
      <LecturePoolDetail />
    </div>
  );
}
