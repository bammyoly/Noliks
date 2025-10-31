import { useNavigate } from 'react-router-dom';
import hero from '../assets/hero.jpg'; // adjust path if needed

const Home = () => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* BG image */}
      <img
        src={hero}
        alt="Hero"
        className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
      />

      {/* Dark/fade overlay (optional, makes text pop) */}
      <div className="absolute inset-0 bg-white/50" />

      {/* Content */}
      <div className="relative text-center p-8 max-w-4xl">
        <h1 className="text-6xl md:text-8xl font-black text-gray-800 tracking-wider mb-6">
          Send Onchain Messages
        </h1>

        <p className="text-sm md:text-base font-medium text-gray-700 tracking-widest mb-10 uppercase">
          A Wallet to Wallet Mail Sending App Fully Encrypted with Zama/FHE
        </p>

        <div className="flex justify-center gap-6 flex-wrap">
          <button
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-lg 
              rounded-md shadow-lg transition-colors"
          >
            LOG IN
          </button>

          <button
            onClick={() => handleNavigation('/compose')}
            className="px-8 py-3 bg-gray-900 hover:bg-gray-700 
              text-yellow-400 font-semibold text-lg cursor-pointer
              rounded-md shadow-lg transition-colors"
          >
            GET STARTED
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
