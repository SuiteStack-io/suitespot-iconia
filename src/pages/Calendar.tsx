import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Calendar = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/pms/availability', { replace: true });
  }, [navigate]);

  return null;
};

export default Calendar;
