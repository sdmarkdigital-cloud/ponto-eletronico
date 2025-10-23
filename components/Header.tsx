
import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { LogoutIcon } from './icons';
import { User } from '../types';

const Header: React.FC = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <header className="bg-secondary p-4 shadow-lg flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center font-bold text-text-button text-xl">
          SG
        </div>
        <h1 className="text-xl font-bold text-accent">STARKER GOOT ENGENHARIA</h1>
      </div>
      {user && (
        <div className="flex items-center space-x-4">
          <span className="text-text-muted">Olá, {user.name}</span>
          <button
            onClick={logout}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
            title="Sair"
          >
            <LogoutIcon className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;