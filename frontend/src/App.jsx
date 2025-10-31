import RouterLinks from "./routes/RouterLinks";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <RouterLinks />
      </main>
    </div>
  );
}

export default App;
