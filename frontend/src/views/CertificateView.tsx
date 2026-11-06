import { User } from '../types';

interface CertificateViewProps {
  user: User | null;
}

const CertificateView = ({ user }: CertificateViewProps) => {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-4xl font-bold text-[color:var(--primary-color)] mb-4">Поздравляем!</h1>
      <p className="text-xl mb-8">Вы успешно прошли все курсы по финансовой грамотности.</p>
      <div className="bg-white border-2 border-dashed border-[color:var(--primary-color)] p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Сертификат</h2>
        <p className="text-lg">Настоящим подтверждается, что</p>
        <p className="text-3xl font-bold my-4">{user?.firstName}</p>
        <p className="text-lg">успешно прошел(ла) курс по финансовой грамотности</p>
      </div>
    </div>
  );
};

export default CertificateView;
