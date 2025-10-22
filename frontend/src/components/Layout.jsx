import React from 'react';
import Navbar from './Navbar';
import { Box } from '@radix-ui/themes';

const Layout = ({ children }) => {
  return (
    <div>
      <Navbar />
      <Box p="4">
        <main>{children}</main>
      </Box>
    </div>
  );
};

export default Layout;