import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MdHome, MdOutlineEdit, MdInbox, MdSend, MdMenu, MdClose } from 'react-icons/md';
import { FiLogOut } from 'react-icons/fi';

const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Home', path: '/', Icon: MdHome },
    { name: 'Compose', path: '/compose', Icon: MdOutlineEdit },
    { name: 'Inbox', path: '/inbox', Icon: MdInbox },
    { name: 'Sent', path: '/sent', Icon: MdSend },
  ];

  const currentPath = location.pathname;

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Top bar for mobile */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-100 shadow-md">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-md text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Open navigation"
        >
          <MdMenu className="w-7 h-7" />
        </button>
      </div>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50
          w-64 bg-gray-100 shadow-xl p-4
          flex flex-col justify-between
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:h-screen
        `}
      >
        {/* Header + Close (mobile) */}
        <div className="flex items-center justify-between mb-8 lg:mb-8">
          <div className="text-3xl font-bold text-gray-600">
            Noliks
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-200"
            aria-label="Close navigation"
          >
            <MdClose className="w-6 h-6" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1">
          <nav className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`
                  flex items-center p-3 rounded-lg text-lg font-medium transition-colors
                  ${
                    currentPath === link.path
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                <link.Icon className="h-5 w-5 mr-3" />
                {link.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom / Connect */}
        <div className="mt-8">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-700
                      text-yellow-400 font-semibold rounded-lg shadow-md transition-colors text-lg"
                  >
                    LOG IN
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700
                      text-white font-semibold rounded-lg shadow-md transition-colors text-lg"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex justify-center">
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-lg shadow-md transition-colors text-lg
                      flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    <span className="truncate">
                      {account.displayName}
                    </span>
                    <FiLogOut className="h-5 w-5 ml-2 flex-shrink-0" />
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
