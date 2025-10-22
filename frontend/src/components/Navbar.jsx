import React from 'react';
import { Link } from 'react-router-dom';
import { Flex, Text, Button } from '@radix-ui/themes';
import ThemeSwitcher from './ThemeSwitcher';

const Navbar = () => {
  return (
    <Flex
      as="nav"
      align="center"
      justify="between"
      p="4"
      borderBottom="1px solid var(--gray-a5)"
    >
      <Flex align="center" gap="3">
        <Link to="/">
          <img src='./assets/logo.svg' style={{ width: '64px', height: '64px' }} />
        </Link>
      </Flex>

      
        <Flex align="center" gap="4">
          <Link to="/rooms">
            <Button variant="ghost" >Rooms</Button>
          </Link>
          <Link to="/reservations">
            <Button variant="ghost">Reservations</Button>
          </Link>
          <Link to="/customers">
            <Button variant="ghost">Customers</Button>
          </Link>
          <ThemeSwitcher />
        </Flex>
        
      
    </Flex>
  );
};

export default Navbar;
