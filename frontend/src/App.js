import * as React from "react";
import { Routes, Route, Outlet, Link, BrowserRouter as Router, useSearchParams} from "react-router-dom";
import { Container, Typography } from '@mui/material';
import SecondScreenInstructions from "./components/SecondScreenSplash";
import SecondScreenLogin from "./components/SecondScreenLogin";
import SignedIn from "./components/SignedIn";
import SecondScreenSignedIn from "./components/SecondScreenSignedIn";

export default function App() {
  return (
    <Container>
      <Typography
          component="h1"
          variant="h2"
          sx={{fontWeight: "500", marginTop: "20px"}}
          align="center"
          color="#ffd78f"
          gutterBottom
          gutterTop
        >
          Second Screen Sign In Demo
        </Typography>

      <Router>
      <Routes>
        <Route path="/">
          <Route index element={<SecondScreenInstructions />} />
          <Route path="/tv" element={<SecondScreenLogin />} />
          <Route path="/signedIn" element={<SignedIn />} />
          <Route path="/secondScreenSignedIn" element={<SecondScreenSignedIn />}/>
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
      </Router>
      
      <Outlet />

    </Container>
  );
}

function NoMatch() {
  return (
    <div>
      <h2>Nothing to see here!</h2>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </div>
  );
}